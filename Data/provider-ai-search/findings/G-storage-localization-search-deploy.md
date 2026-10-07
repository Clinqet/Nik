# G — Storage · Localization · Search infra · Deploy plumbing (Provider AI Search research)

> **COMPLETE.** Every area closed. Read-only pass over `C:\Nik\*`, re-verified 2026-09-02 against the CURRENT
> trees (`clinqetshared e5bec24 · clinqetcore fd04b1a · clinqetinfrastructure 6341780 · clinqetapi 6a61450 ·
> clinqetmcp 8406310 · clinqetfuncations 43ec2c0 · clinqetwebpartnerapp 99ff26ba · clinqetmobilepartnerapp
> bd630f0e · azureautomation 2cdefa2 · cosmosindexsetup 9e755d8` — all clean, `git status --porcelain` empty).
> No repo file was created, edited or deleted; this file is the only output. Line numbers are 1-based as shown
> by `cat -n`/`sed -n`. "NOT FOUND" means searched and absent, never inferred.
>
> **§0 lists the eight things that changed since the first draft of this file** (the previous trees were at older
> HEADs) and **§F.1 lists what CONTRADICTS PLAN.md §4.5 / §10.**

---

## 0. What changed since the earlier draft of this file (re-verification deltas)

| # | Earlier claim | Current truth |
|---|---|---|
| 1 | Residual open item: "does `ManageServicesPrice.jsx` read `?serviceId=`?" | **CLOSED — YES.** The component is now a FOLDER: `clinqetwebpartnerapp\src\components\onboarding\add-business-information\ManageServicesPrice\index.jsx:201-244` reads `serviceId` AND `businessId`, switches workspace, cleans the URL and opens the edit modal (C.4) |
| 2 | "Mobile deep link cannot open a specific service" | **WRONG — it can.** `clinqetmobilepartnerapp\src\Screen\completeProfileFlow\AddService\index.tsx:126-161, 939-944, 1100-1121` consumes `{serviceId, businessId, entryContext}`; `src\Util\notificationNavigation.ts:36-46` already emits exactly that shape. The earlier pass measured `ManageService` (the LIST screen), which indeed reads no params (C.4) |
| 3 | Localization key counts 3,047 / 5,792 / 5,486 | **3,121 / 5,929 / 5,619** — recomputed 2026-09-02, parity 0 missing / 0 extra on all four translated files in all three surfaces (B) |
| 4 | "ONE AI Foundry account, East US 2" | **TWO accounts.** PRE-PHASE C2 (`deploy.ps1:3013-3104`) creates a dedicated **India realtime Foundry in Sweden Central** — **voice models ONLY**; chat/embedding/reasoning/summary stay on the shared East US 2 account for every stamp including IN (D.1) |
| 5 | "No inline-view variant exists" | **A controller precedent DOES exist.** `VoiceAssistantController.cs:700-716` mints an INLINE playback URL with `TransformToPublicUrl` for the private `voice-recordings` container, and `:719-738` the `attachment` sibling — with `RequireSignedRecordingUrl` (:742-750) failing loudly when no SAS came back (A.1, E.1) |
| 6 | `ProviderKnowledgeSearchService.cs` (path implied under `Services\Voice\`) | Actual path `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` (861 lines) |
| 7 | `ServiceImage.cs` in `clinqetcore\Entities\COSMOS\` | Actual path `clinqetshared\Models\ServiceImage.cs` (59 lines) |
| 7b | OCR page-cache path gained a `{deploymentName}` segment | **Retracted** — that is another session's UNCOMMITTED edit, not `fd04b1a`. HEAD is `…/{contentHash}/v{promptVersion}/p{NNN}.md` (`KnowledgeBlobPaths.cs:115-116`). See §G.1 |
| 8 | Images DTO exposes `thumbUrl` / `imageUrl` | DTO members are **`ThumbnailUrl`** and **`Url`** (`KnowledgeDtos.cs:118, 120`) — deliberately named for the platform image shape so `getThumbSrc`/`getOriginalSrc` work unchanged |

Plus: `deploy.ps1` grew 8,161 → **9,079 lines**, so every `deploy.ps1` anchor below is re-read (roughly +87 lines
from the earlier draft). Search-client registration in all three hosts moved +7 to +14 lines.

---

## 1. Executive summary

1. One blob abstraction: `IAzureStorageService` (`C:\Nik\clinqetcore\Interfaces\Storage\IAzureStorageService.cs:7-58`, 59 lines) implemented by `C:\Nik\clinqetinfrastructure\Services\Storage\AzureStorageService.cs` (1,959 lines). Two SAS modes — shared key from a connection string (`:110-116`), or **user-delegation SAS under `DefaultAzureCredential`** when only `AccountUrl` is set (`:117-124`). Deployed hosts get `StorageConfiguration__AccountUrl` + `__FrontDoorBaseUrl` and a BLANK `__ConnectionString` (API `deploy.ps1:7147, 7228-7229`; Functions `:6868, 6975-6976`) ⇒ **delegation mode in every environment**.
2. Knowledge originals live in the PRIVATE container `provider-knowledge` (`StorageConfiguration.cs:119`; `Clinqet.API\appsettings.json:2996`; ARM `storage.json:679-690`, `publicAccess: None` at `:688`) under `{businessId}/{docId}/{name}-{yyyyMMdd-HHmmss}-{fileId12}{ext}`; extracted images at `{businessId}/_images/{docId}/{imageId}{ext}` with WebP thumbs `…{ext}.thumb.webp` (`KnowledgeBlobPaths.cs:87-97`; `MediaDerivativeProcessorFunction.cs:538`; `MediaDerivativeSettings.cs:13`).
3. **No provider-facing endpoint today returns a URL for, or streams, the ORIGINAL knowledge document.** The only URL-minting knowledge endpoint is `GET api/v1/knowledge/documents/{docId}/images` (`voice.read`) — a 60-minute read SAS on the RAW blob host, HTTPS-only, served inline (`KnowledgeController.cs:522-551` + `:855-900`).
4. Three read-SAS TTL dials: `ReadSasExpiryMinutes` = 30 (`AppendReadSas` ⇒ `TransformToPublicUrl` / `TransformToDownloadUrl`), `InternalSasExpiryMinutes` = 60 (`CreateSasBuilder` fallback ⇒ `GetUrlForReadAsync` / `GetUrl`), and WhatsApp document links at 720 min (`AzureStorageService.cs:130-131, 1011, 1265`; `appsettings.json:2653-2654`; `WhatsAppSettings.cs:116-123`). Upload SAS = 15 min (`:1606`; `MediaConstraints.UploadSasExpiryMinutes` `StorageConfiguration.cs:98`).
5. Cost: `GetUrlForReadAsync` spends **ONE storage round trip per URL** (`GenerateSasUrlAsync :1212` → `EnsureContainerExistsAsync :1232` → `CreateIfNotExistsAsync :1309/1319`); `AppendReadSas` / `TransformToPublicUrl` / `TransformToDownloadUrl` / `GetUrl` / `BuildStorageUrl` sign **locally with no storage call**. `KnowledgeController.cs:98-102` documents exactly this and therefore never mints URLs in the polled list.
6. **The "inline view link" primitive already exists and is already used in a controller.** `TransformToPublicUrl` on a non-public container returns an FD-routed URL + 30-min read SAS with no `rscd` override (so the browser renders inline); `VoiceAssistantController.cs:700-716` does precisely this for the private `voice-recordings` container, with `TransformToDownloadUrl` (:719-738) as the `attachment` sibling and `RequireSignedRecordingUrl` (:742-750) as the "no SAS came back ⇒ say unavailable" guard.
7. Localization: API = 5 files (`en, es, fr, gu, hi`) × **3,121** flattened keys, parity enforced by `LocalizationResourceTests.cs:77-91`. Partner web = 5 files × **5,929** leaf keys (parity test loads all five incl. `es-US`) although `IntlProvider` serves only `en/fr/gu/hi`. Partner mobile = 5 files × **5,619** keys, 4 registered. Email templates 103 files × 5 languages; SMS `en`=20, others=1. **A new string is 15 files.**
8. Azure AI Search: three ALIASES (`clinket`, `clinket-providers`, `clinket-knowledge` + env suffix; physical `{name}-{IndexVersion}`, `cosmosindexsetup\Program.cs:48-50`), one endpoint + admin key per stamp (`deploy.ps1:1603-1605, 6813`), key-only auth on a `basic` SKU with 1 replica / 1 partition (`ai.json:88-105`). Clients are config-built singletons (`Clinqet.API\Program.cs:954-999`); SDK `Azure.Search.Documents 12.0.0` with **no explicit `SearchClientOptions`/`ServiceVersion`** (NOT FOUND) ⇒ SDK default API version.
9. Tenant scoping in the index = OData `businessId eq '…'` + `AssertScoped(filter, businessId)` + post-read per-hit `businessId` verification with a cross-tenant alarm and whole-result-set discard (`ProviderCatalogSearchService.cs:48-54, 93-94, 266-267, 288-293, 331-332, 624`; `ProviderKnowledgeSearchService.cs:131-132, 291-294, 303-308, 672-702`).
10. Service index carries `businessId`, `categoryId/Name`, `subcategoryId/Name`, `serviceId/Name`, the full price tier set, `serviceImages{original,thumb,medium,width,height}`, `isActive`, `isListed`, `businessStatus` (`SearchDocument.cs`, 591 lines). **`approvalStatus` and a per-service slug are NOT in the index** — a card showing "Pending approval" needs the Cosmos row.
11. Categories: one Cosmos `Category` entity in container `ProviderData` with `ParentCategoryId` and a denormalised `FullPath` ("Appliance Services > Washing Machine") (`Cosmos.cs:336-370`); the global list is cached 24 h under key prefix `GlobalCategories` with `Size = 1` + `Priority High` and a generation counter (`CategoryCacheService.cs:39-41, 67-87`). **Category names are NOT localized** — one `Name`, no translation mechanism anywhere (re-verified).
12. AI: `$modelDeployments` (`deploy.ps1:2739-2748`) declares 6 deployments on the shared East US 2 Foundry account; a deployment outside that array is never visited by the RAI loop and serves with **no `ClinketContentFilter`** (`AiModels.cs:5-6`; `deploy.ps1:2825, 2909-2999`). Per-flow deployment names reach the API as `__` app settings in TWO blocks (`:7175-7180`, `:7597-7602`) and are pinned by `AiModelPinConventionTests.cs:55-150` + `AiTokenPricingConventionTests.cs:13-29`. Foundry/Search keys are PLAIN app settings, not Key Vault references.
13. Streaming caveat: Front Door's origin timeout is 240 s (the AFD max) and the ARM parameter states that **AFD does not support SSE streaming** (`networking.json:11-18`) — and the API is served THROUGH Front Door at `api-<slug>.<apex>` (`deploy.ps1:1137-1153, 4255`), which is exactly the host the partner web calls (`clinqetwebpartnerapp\.env:17`). The existing `/ai/chat` SSE lives with this today (`AIAssistantController.cs:1256-1273`).

---

## A. Storage & document access

### A.1 Blob abstraction, containers, SAS generation, Front Door / CDN, Content-Disposition

**Interface** — `C:\Nik\clinqetcore\Interfaces\Storage\IAzureStorageService.cs` (59 lines). Members relevant to
a view link:

| Member | Line |
|---|---|
| `Task<Stream> GetBlobStreamAsync(string blobUrl, …)` / `(container, dir, blob, …)` | :22 / :23 |
| `Task<(long ContentLength, string ContentType)?> GetBlobMetadataAsync(…)` | :27 |
| `Task<byte[]> GetBlobHeaderAsync(…)` | :30 |
| **`Task<Uri> GetUrlForReadAsync(container, directoryName, blobName, ct)`** | :35 |
| `Uri GetUrl(Uri uri, FileAccessPolicy storedPolicyName = Read)` | :36 |
| **`string TransformToPublicUrl(string internalBlobUrl)`** | :46 |
| **`string TransformToDownloadUrl(string internalBlobUrl, string downloadFileName, string? contentType = null)`** | :47 |
| `string BuildStorageUrl(container, blobName)` | :48 |
| `Task<string> UploadDocumentAndGetReadSasUrlAsync(container, blobName, bytes, contentType, sasExpiryMinutes, ct)` | :50 |
| `Task<IReadOnlyList<string>> ListBlobNamesAsync(container, prefix, maxResults, ct)` | :55 |
| `(string Container, string BlobName)? TryParseBlobUrl(string blobUrl)` | :57 |

**Implementation** — `C:\Nik\clinqetinfrastructure\Services\Storage\AzureStorageService.cs` (1,959 lines, read end-to-end):

| Concern | Evidence |
|---|---|
| Credential mode | `ConnectionString` ⇒ `BlobServiceClient(cs)` + `StorageSharedKeyCredential`, `_useDelegationSas = false` (`:110-116`); `AccountUrl` only ⇒ `BlobServiceClient(uri, new DefaultAzureCredential())`, `_useDelegationSas = true`, `InitializeUserDelegationKey()` (`:117-124`); neither ⇒ throw (`:125-128`). Delegation key cached with a 1 h lifetime, refreshed under `SemaphoreSlim _delegationKeyLock` 10 min before expiry (`:38-39, 165-205`); sync path `GetDelegationKeyOrThrow` (`:207-218`) |
| Read-SAS TTL **30 min** | `_readSasExpiryMinutes = config.ReadSasExpiryMinutes > 0 ? … : 30` (`:130`); consumed by `AppendReadSas` (`:1011`) ⇒ `TransformToPublicUrl` (`:929-960`) and `TransformToDownloadUrl` (`:965-996`); also the fallback in `UploadDocumentAndGetReadSasUrlAsync` (`:1123`) |
| Read-SAS TTL **60 min** | `_internalSasExpiryMinutes = … : 60` (`:131`); `CreateSasBuilder(permissions, expiryMinutes: null)` falls back to it (`:1263-1271`), so `GetUrlForReadAsync` (`:852-874` → `GenerateSasUrlAsync :1212-1248`) and `GetUrl` (`:876-927`) mint **60-minute** read SAS |
| Upload SAS | `SasUrlRequest.ExpiryInMinutes ?? 15` (`:1606`); permissions default `Create\|Write\|Delete` (`:1608`); `rsct` = requested content type (`:1614`); blob name `{BuildBlobPath(businessId, entityId, entitySuffixId, dir, isVideo)}/{sanitizedName}-{yyyyMMdd-HHmmss}-{fileId12}{ext}` (`:1588-1598`); FD-routed unless the container is in `DirectUploadContainers` (`:1628-1631` → `ShouldRouteUploadThroughFrontDoor :1205-1209`, `TransformSasUriToFrontDoor :1196`) |
| Protocol / IP | `SasProtocol.Https` on every SAS (`:1286`, `:1613`); `Delete` stripped from read/create SAS by `EnhanceSasTokenSecurity` (`:1273-1287`). **SAS IP-range restriction: NOT FOUND** (no `IPRange` in the file) |
| **Response-header overrides** | `AppendReadSas(container, pathAndQuery, baseUrl, contentDisposition? = null, contentType? = null)` (`:998`) sets `sasBuilder.ContentDisposition` (`rscd`) and `sasBuilder.ContentType` (`rsct`) (`:1012-1013`). **Only `TransformToDownloadUrl` passes a disposition** — `attachment; filename="…"; filename*=UTF-8''…` (`:962-996`). `TransformToPublicUrl` passes NEITHER ⇒ the response uses the blob's STORED headers ⇒ **inline for anything the browser can render**. There is no third method, and none is needed |
| Stored headers at upload | Generic uploads: `AccessTier.Hot`, `Cache-Control: max-age=86400`, NO stored disposition (`:270-292`). Derivatives + knowledge images (`UploadDerivativeBlobAsync :1051-1089`): `Content-Disposition: inline`, `Cache-Control: public, max-age=86400` (`:1073-1076`). WhatsApp/transactional PDFs (`UploadDocumentAndGetReadSasUrlAsync :1094-1132`): `inline`, `no-store` (`:1116-1118`) |
| Host returned | `GetUrlForReadAsync` returns the **raw `*.blob.core.windows.net`** SAS URI (`:852-874`; the FD branch at `:839-840` is the UPLOAD path only); `TransformToPublicUrl` rewrites to `FrontDoorBaseUrl` and appends a 30-min SAS for any container NOT in `PublicContainers` (`:941-957`); `BuildStorageUrl` prefers FD (`:1038-1049`); `UploadDocumentAndGetReadSasUrlAsync` is FD-routed (`:1131`) |
| **Storage call per URL** | `GenerateSasUrlAsync :1232` → `EnsureContainerExistsAsync :1303-1326` → `CreateIfNotExistsAsync` on **every call** (`:1309`, `:1319`). `AppendReadSas` (`:998-1036`), `GetUrl` (`:876-927`) and `BuildStorageUrl` (`:1038-1049`) make **no** storage call |
| Public containers | CSV `PublicContainers` parsed at `:134-137` = `serviceimages,portfoliomedia,profilepictures,categoryicons,reviewimages` (`appsettings.json:2650`); everything else is SAS-gated |
| Byte reads | `GetBlobStreamAsync` buffers the whole blob into a `MemoryStream` (`:667-696`, `:701-732`); `GetBlobHeaderAsync` reads a ranged prefix (`:597-635`); `GetBlobMetadataAsync` returns `(ContentLength, ContentType)` (`:565-595`) |
| CDN | **No separate CDN.** The only `Microsoft.Cdn/profiles` resource is the Front Door profile itself, `Standard_AzureFrontDoor` (`networking.json:761-771`). Origin groups for api / identity / admin / partner / customer / **storage** / function at `:810, 826, 842, 858, 874, 890, 907`; storage origin `:1013`; `StorageCacheRules` rule set `:1319` |

**Settings class** — `C:\Nik\clinqetcore\Models\Storage\StorageConfiguration.cs` (121 lines):
`ReadSasExpiryMinutes = 30` :15 · `InternalSasExpiryMinutes = 60` :16 · `FrontDoorBaseUrl` :17 ·
`PublicContainers` :18 · `RouteUploadsThroughFrontDoor = true` :21 · `DirectUploadContainers` :23 ·
`ProviderKnowledge` constraints :57-78 (**30 MB** `:59`, **20 files** `:60`, extensions
`.pdf .docx .xlsx .pptx .txt .md .json .html .htm .jpg .jpeg .png .gif .webp .tiff .bmp` `:64-68`,
MIME allow-list `:69-77`; **`.heic/.heif` deliberately absent** — comment `:61-63`: no HEIF decoder in
ImageSharp) · `MediaConstraints.UploadSasExpiryMinutes = 15` :98 · `ContainerConfiguration` :101-120
(`ProviderKnowledge = "provider-knowledge"` :119).

**Bound config (API)** — `C:\Nik\clinqetapi\Clinqet.API\appsettings.json`:
`StorageConfiguration` :2648-2662 (`AccountUrl` :2649 blank ⇒ deploy-provided · `PublicContainers` :2650 ·
`RouteUploadsThroughFrontDoor: true` :2651 · `DirectUploadContainers: ""` :2652 · `ReadSasExpiryMinutes: 30`
:2653 · `InternalSasExpiryMinutes: 60` :2654 · `MaxConcurrentOperations: 3` :2658 · `NetworkTimeoutSeconds: 180`
:2662); `ProviderKnowledge` block :2943-2983 (`MaxFileSizeBytes 31457280` :2944, `MaxFileCount 20` :2945,
`UploadSasExpiryMinutes 15` :2982); `Containers` :2984-2997 (`ProviderKnowledge` :2996).
`FrontDoorBaseUrl` is NOT in appsettings.json — deployed as `StorageConfiguration__FrontDoorBaseUrl =
$AssetsRegionalBaseUrl` (`deploy.ps1:7229` API, `:6976` Functions, `:7349`-area Identity) alongside
`StorageConfiguration__AccountUrl` (`:7228` / `:6975`), which is also a REQUIRED app setting for all three hosts
(`deploy.ps1:1841, 1859, 1889`). `$AssetsRegionalBaseUrl = "https://$AssetsRegionalCustomDomain"` (`:4130`).

**ARM** — `C:\Nik\azureautomation\storage.json`: `Standard_LRS` / `StorageV2` (:54-58),
`minimumTlsVersion TLS1_2` (:64), `allowBlobPublicAccess: true` (:65), `allowSharedKeyAccess: true` (:66),
`accessTier: Hot` (:89). 20 containers declared (:393-690); **`publicAccess: "Blob"` on exactly six** —
`categoryicons` (:454/463), `assets` (:469/478), `portfoliomedia` (:574/583), `profilepictures` (:589/598),
`reviewimages` (:649/658), `serviceimages` (:664/673). `provider-knowledge` (:679-690) is `"None"` (:688), as
are `licensedocuments`, `provider-setup-docs`, `messageattachments`, `bookingattachments`, `quoteattachments`,
`broadcast`, `voice-transcripts`, `voice-recordings`, `invoicedocuments`, `bookingdocuments`, `quotedocuments`,
`sitemaps`, `analytics`. Lifecycle rules: `provider-knowledge-sent-lifecycle-policy` deletes
`provider-knowledge/_sent/` after `invoiceDocumentRetentionDays` (:269-288, param doc :36);
`ocr-page-cache-lifecycle-policy` cools `provider-knowledge/_ocr/` at 50 days and deletes at 180 (:291-314).
**No lifecycle rule touches `provider-knowledge/{businessId}/…` originals or `_images/`.**

**URL validator** — `C:\Nik\clinqetinfrastructure\Services\Storage\BlobUrlValidator.cs` (140 lines):
HTTPS + host must equal the storage host **or** the FD host (:41-50); `IsValidBlobUrlForBusiness` requires path
segment[1] == businessId (:57-81); `ConvertToInternalUrl` maps FD → blob host (:85-99).

**Legacy / dead** — `StorageManagerService.GenerateSecureDownloadUrlAsync(fileUrl, expiryHours = 24)`
(`StorageManagerService.cs:528`) mints a **24-hour shared-key** SAS via `blobClient.GenerateSasUri` — which
throws under delegation mode. **Callers: NOT FOUND** (repo-wide grep across all five .NET repos returns only the
declaration). Do not reuse; §22.2 removal candidate.

**Derivative engine** — `C:\Nik\clinqetinfrastructure\Services\Storage\MediaDerivativeService.cs:13-…`: WebP
thumb + optional medium, EXIF/ICC/IPTC/XMP stripped (:77-80), decode ceiling `MaxDecodedPixels` (:61),
`WebpEncoder { Quality = _settings.WebpQuality }` (:91). Settings
`C:\Nik\clinqetshared\Models\MediaDerivativeSettings.cs`: `ThumbnailMaxEdge 240` :5, `MediumMaxEdge 800` :6,
**`KnowledgeThumbnailMaxEdge 320`** :10, `WebpQuality 82` :11, `ThumbSuffix ".thumb.webp"` :13,
`MediumSuffix ".medium.webp"` :14.

### A.2 Knowledge document + image storage, and EVERY endpoint that returns a URL or bytes

**Registry row** — `C:\Nik\clinqetcore\Entities\COSMOS\KnowledgeDocument.cs:10-93` (189 lines), container
`KnowledgeBase`, pk `/businessId` (`appsettings.json:697` = `KnowledgeBase-dev`). Citation-card fields:
`BusinessId` :12-13 · `DocId` :16-17 · **`DocName`** (original filename) :20-21 · **`DocTitle`** :24-25 ·
`DocType` :29-30 · `LinkedServiceIds` :34-35 · `Status` :39-40 · `FailureReasonKey` :43-44 · `SizeBytes` :46-47 ·
**`PageCount`** :49-50 · `PassageCount` :52-53 · `ContentHash` :56-57 · **`BlobPath`** :59-60 · `SourceKind` :64-65 ·
`ShareWithCallers` :70-71 · `FaqQuestion/Answer` :73-77 · `ServiceDraftAnalytics` :81-82 · `Images` :87-88 ·
`DroppedImages` :91-92.

**Image registry entry** — `KnowledgeDocumentImage` :98-160: `ImageId` (SHA-256[..16] of bytes) :100-101 ·
`Page` :103-104 · `AnchorPath` :106-107 · `BlobPath` :109-110 · `ThumbPath` :113-114 · `ContentHash` :117-118 ·
`Kind` :122-123 · `Caption` :127-128 · `Sendable` :131-132 · `Width/Height/Bytes` :134-141 · `Source` :145-146 ·
`Status` (tombstone = `Deleted`) :150-151 · `Quality` :158-159.

**Blob layout** — `C:\Nik\clinqetcore\Models\Knowledge\KnowledgeBlobPaths.cs` (167 lines):
- original prefix `{businessId}/{docId}/` — `SourcePrefix` :87-88; file name comes from the upload SAS
  (`EntitySuffixId = docId`, `KnowledgeController.cs:262-277`; `AzureStorageService.cs:1588-1598`); the
  confirm-time guard `IsDirectSourceBlob` :18-29 enforces the prefix (D22)
- images `{businessId}/_images/{docId}/{imageId}{ext}` — `ImagesPrefix` :90-91, `ImageBlob` :96-97;
  thumb name = `{BlobName}.thumb.webp` (`MediaDerivativeProcessorFunction.cs:538`), thumbnail ONLY, 320 px
  (`:550`, `generateMedium: false`)
- content artefact `{businessId}/_artifacts/{docId}.json.gz` — :93-94 (gzip JSON via
  `KnowledgeContentArtifactStore.cs:88-89, 100-118`)
- draft images `{businessId}/{docId}/drafts/{draftId}/{file}` — :99-104
- OCR page cache `_ocr/{businessId}/{docKey}/{contentHash}/v{promptVersion}/p{NNN}.md` —
  `OcrBusinessPrefix` :109-110, `OcrPrefix` :112-113, `OcrPageBlob` :115-116, `OcrDocumentKey` :119
  (file is 163 lines at HEAD). **See §G.1 — a concurrent session is adding a `{deploymentName}` segment here
  uncommitted; that is NOT in `fd04b1a`.**
- WhatsApp material PDFs `_sent/{businessId}/{callId}-{refsKey}.pdf` — `DocumentDeliveryService.cs:291-293`
- ownership guards: `IsDirectImageBlob` :31, `IsOwnedImageBlob` :43, `IsOwnedDraftImageBlob` :60,
  `EnsureCanonicalDeletionIdentity` :79, `IsCanonicalDocumentId` :7-8 (32 chars), `IsCanonicalBusinessPathSegment` :13-14

**Content types** — originals: whatever the client PUTs (allow-list above; the upload SAS sets only the SAS
`rsct`, `AzureStorageService.cs:1614`). Images: `image/png` or `image/jpeg` inferred from the blob extension
(`KnowledgeImageStore.cs:123`) and uploaded through `UploadDerivativeBlobAsync` (`:49`) ⇒ stored
`Content-Disposition: inline` + `Cache-Control: public, max-age=86400`. Thumbnails: `image/webp` via the
media-derivative queue (`KnowledgeImageStore.cs:102-129`, `ParentEntity = MediaParentEntity.KnowledgeImage` :111,
`forceAdminAlert: true` :129).

**Every provider-app endpoint under `api/v{version}/knowledge`** —
`C:\Nik\clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs` (951 lines; route :31;
`ImageSasConcurrency = 8` :45):

| Route | Lines | Permission (Business scope) | URL / bytes returned? |
|---|---|---|---|
| `GET documents` | :73-133 | `voice.read` (:79) | **No.** Counts only; `:98-102` explains that a read-SAS costs a storage round trip, so the polled list never mints URLs (~1,600 calls/poll avoided) |
| `POST documents/sas-urls` | :135-317 | `voice.settings.manage` (:142) | **Upload SAS** `Create\|Write` (:266), TTL `StorageConfiguration:ProviderKnowledge:UploadSasExpiryMinutes` = 15 (:267), FD-routed; `FileUrl` = the stored (unsigned) URL (:301); doc/passage/size caps :162-195, :212-222 |
| `POST documents/confirm` | :319-371 | `voice.settings.manage` (:326) | No (D22 prefix check :346; blob-exists check :355-356) |
| `DELETE documents/{docId}` | :373-400 | `voice.settings.manage` (:379) | No |
| `POST documents/{docId}/reprocess` | :402-434 | `voice.settings.manage` (:409) | No |
| `PATCH documents/{docId}` | :436-474 | `voice.settings.manage` (:443) | No |
| `PATCH documents/{docId}/sharing` | :478-518 | `voice.settings.manage` (:486) | No |
| **`GET documents/{docId}/images`** | :522-551 (+ `LiveImages` :848-849, `BuildImageDtosAsync` :855-900) | `voice.read` (:528) | **Yes** — per live image `ThumbnailUrl` (from `ThumbPath`, :874) + `Url` (from `BlobPath`, :876) via `GetUrlForReadAsync(container, "", path, ct)` ⇒ read SAS, **60 min** (`InternalSasExpiryMinutes`), HTTPS-only, **raw blob host (not FD)**, **no `rscd` override ⇒ inline** (stored disposition). `Parallel.ForEachAsync` bounded to `ImageSasConcurrency = 8` (:865); a per-image failure logs a warning and yields nulls (:878-883). **One storage round trip per URL.** DTO `KnowledgeDocumentImageDto` (`clinqetshared\DTOs\Knowledge\KnowledgeDtos.cs:98-120`) |
| `PATCH documents/{docId}/images/{imageId}/sendable` | :556-600 | `voice.settings.manage` (:564) | No |
| `DELETE documents/{docId}/images/{imageId}` | :604-642 | `voice.settings.manage` (:612) | No |
| `POST documents/{docId}/rerun-analytics` | :646-682 | `voice.settings.manage` (:653) | No |
| `POST service-drafts/rerun-all` | :685-707 | `voice.settings.manage` (:691) | No |
| `POST faqs` · `PUT faqs/{docId}` · `DELETE faqs/{docId}` | :709-828 | `voice.settings.manage` (:715, :760, :807) | No |

- `KnowledgeServiceDraftsController.cs` (426 lines, route `api/v{v}/knowledge/service-drafts` :22):
  `GET ""` `voice.read` (:39-45); dismissals `voice.settings.manage` (:118-230); approvals
  `catalog.service.create` / `catalog.service.update` (:231-385). **No URL-minting call in the controller** —
  the draft `imageUrl` values the web renders (`KnowledgeServiceDraftsSection.jsx:129-131`,
  `KnowledgeDraftEditModal.jsx:390-395`) are minted server-side by
  `KnowledgeDraftApprovalService.cs:1252` (`GetUrlForReadAsync` ⇒ 60 min, raw host).
- Admin: `SearchAdminController.cs` `GET knowledge-health/{businessId}` and
  `POST reindex-knowledge/{businessId}/{docId}` — health/repair only, no URLs. `AdminProviderController.cs`
  has no knowledge surface.
- **Endpoint returning a URL for, or streaming the bytes of, the ORIGINAL document
  (`KnowledgeDocument.BlobPath`): NOT FOUND.** Repo-wide grep of
  `clinqetapi\Clinqet.API\Controllers` for `GetUrlForReadAsync` / `TransformToPublicUrl` /
  `TransformToDownloadUrl` / `GetBlobStreamAsync` / `return File(` / `FileStreamResult` yields exactly:
  `BookingController.cs:3368`, `Broadcast/BroadcastController.cs:636`, `Knowledge/KnowledgeController.cs:874, 876`,
  `LicenseController.cs:636-640`, `QuoteController.cs:1204`, `ReviewController.cs:1166-1168`,
  `Voice/VoiceAssistantController.cs:708, 731`, and the only `File(...)` results —
  `BookingPaymentController.cs:200`, `ProviderBillingController.cs:1848`, `Seo/SitemapController.cs:60-71`.
- Non-controller read-SAS minting on knowledge ORIGINALS (internal, for Document Intelligence reads):
  `KnowledgeIngestProcessorFunction.cs:1079` and `KnowledgeServiceDraftAnalyticsJob.cs:304` — both
  `GetUrlForReadAsync(container, "", row.BlobPath, ct)`.
- The list DTO (`ToDto` :902-926) exposes no URL. The partner web knowledge UI has **no "open document"
  affordance**: grep for `href=` / `window.open` / `download` / `target="_blank"` across
  `src\components\Profile\knowledge\*.jsx` returns exactly one hit —
  `KnowledgeServiceDraftsSection.jsx:89`, a link to `/dashboard/profile/manage-services-price`.

### A.3 The inline/attachment URL precedent already in the API (directly reusable)

`C:\Nik\clinqetapi\Clinqet.API\Controllers\Voice\VoiceAssistantController.cs` (route
`api/v{version:apiVersion}/voice-assistant` :22):

| Piece | Lines | What it does |
|---|---|---|
| `GET call-summaries/{callId}/recording-download-url` | :659-696 | `[RequiresPermission("voice.transcript.read")]` (:665); ownership via a **partition-scoped** repo read `GetByCallIdAsync(callId, businessId)` (:676); returns `ApiResponse<string>` carrying the URL (:690) |
| `ResolveRecordingUrl` (**INLINE / playback**) | :700-716 | `RequireSignedRecordingUrl(_storageService.TransformToPublicUrl(recordingBlobUrl), "playback")` — FD host, 30-min SAS, **no `rscd`** ⇒ browser renders inline. Comment :698-699: "Recording blob is private ⇒ hand the UI a short-lived read URL on the Front Door host, NEVER the raw blob host (same transform as portfolio/message/document media)". Used in the detail DTO at :554 |
| `ResolveRecordingDownloadUrl` (**ATTACHMENT**) | :719-738 | `TransformToDownloadUrl(recordingBlobUrl, $"call-{callId}{ext}")` — comment :717-718: "Browser/OS downloads the private recording directly from storage via a SAS whose response Content-Disposition is forced to `attachment` ⇒ full file + correct filename, **no API byte-proxying**" |
| `RequireSignedRecordingUrl` | :742-750 | A transformed URL with an EMPTY query means SAS minting or `FrontDoorBaseUrl` is broken ⇒ `LogError` + return null ("unavailable") rather than hand the UI a dead link |

This is the template a knowledge `view-url` / `download-url` endpoint should copy verbatim: **zero storage round
trips, FD-routed (WAF in path, account host hidden), 30-minute TTL, one shared guard.**

### A.4 WhatsApp / knowledge delivery (the other SAS consumer)

`C:\Nik\clinqetinfrastructure\Services\Communication\DocumentDeliveryService.cs`:
- PDFs (booking/quote/invoice/material): `UploadDocumentAndGetReadSasUrlAsync(container, blobName, bytes,
  "application/pdf", d.SasExpiryMinutes)` (:360, :602) ⇒ FD-routed read SAS, stored `inline` + `no-store`
  (`AzureStorageService.cs:1116-1118`). TTLs `WhatsAppSettings.cs:116-123` —
  `Invoice/Booking/Quote/MaterialDocumentSasExpiryMinutes = 720` (12 h); Functions
  `appsettings.json:552-555` = 720. Material PDFs land at
  `provider-knowledge/_sent/{businessId}/{callId}-{refsKey}.pdf` (:291-293) and are reaped by the `_sent/`
  lifecycle rule.
- Knowledge PICTURES: per picture `GetUrlForReadAsync(_containers.ProviderKnowledge, "", blobPath)` (:471-472)
  ⇒ 60-min raw-host SAS handed to Meta as `ImageLink` (:485); minted only AFTER the window/template checks so
  no SAS is spent on a dropped picture.
- **Media proxy endpoint: NOT FOUND** — Meta fetches the SAS URL directly.

### A.5 Cost facts in code/config

- Storage account `Standard_LRS` / `Hot` (`storage.json:54-58, 89`); every generic upload is `AccessTier.Hot`
  (`AzureStorageService.cs:272`).
- Edge = Front Door `Standard_AzureFrontDoor` (`networking.json:761-771`), `originResponseTimeoutSeconds`
  parameter 16-240 default **240** (the AFD max) because of long AI extraction; the same metadata states
  **"AFD does not support SSE streaming"** (`:11-18`). No separate CDN profile.
- Cache-Control: generic uploads `max-age=86400`; derivatives `public, max-age=86400`
  (`AzureStorageService.cs:1075`); WhatsApp PDFs `no-store` (`:1118`).
- Per-URL storage round trip on `GetUrlForReadAsync` vs **none** on `AppendReadSas`/`TransformToPublicUrl`/
  `TransformToDownloadUrl`/`GetUrl` — the difference `KnowledgeController.cs:98-102` is about.
- Lifecycle: `_sent/` deleted after `invoiceDocumentRetentionDays`; `_ocr/` cooled 50 d, deleted 180 d.
- Search service `basic`, 1 replica, 1 partition, `semanticSearch: free` (`ai.json:92-104`).
- `IMemoryCache` is registered with `MemoryCache:SizeLimit = 50000` (`appsettings.json:2-4`) ⇒ **every write
  must set `Size = 1`** (CLAUDE.md §14; `MemoryCacheSizeConventionTests`).
- DataZoneStandard fallback deployments bill **~10% above** GlobalStandard (`deploy.ps1:2866`).

---

## B. Localization inventory

### B.1 API catalogue (`clinqetinfrastructure`, consumed by API / Identity / Functions / MCP)

| Item | Value |
|---|---|
| Files | `C:\Nik\clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json` |
| Keys | **3,121** flattened dot-keys in EVERY file; key-set diff en↔es/fr/gu/hi = **0 missing / 0 extra** both directions (computed 2026-09-02) |
| Config | `Clinqet.API\appsettings.json:2321-2331` — `Directory: "Resources/Localization"` :2322, `DefaultLanguage: "en"` :2323, `SupportedLanguages: [en, hi, gu, fr, es]` :2324-2330 |
| Interface | `C:\Nik\clinqetcore\Interfaces\Language\ILocalizationService.cs:5-13` — `GetLocalizedString`, `IsLanguageSupported`, `GetSupportedLanguages`, `GetDefaultLanguage`, `DetectLanguageFromCulture`, `NormalizeLanguageCode` |
| Implementation | `C:\Nik\clinqetinfrastructure\Services\Language\LocalizationService.cs` (217 lines) — loads every supported language at construction (:49-86), flattens nested JSON + arrays to dot/`[i]` keys (`FlattenJsonObject` :89-113), lookup → default-language fallback → **returns the KEY itself when missing** (`GetLocalizedString` :115-161), `NormalizeLanguageCode` strips region `en-US` → `en` (:198-216) |
| Email templates | `Resources\EmailTemplates\{en,es,fr,gu,hi}\` — **103 files each** |
| SMS templates | `Resources\SmsTemplates\en` = **20** files; `es`/`fr`/`gu`/`hi` = **1** file each |

**Build-failing guards (all in the API repo, all scanning only this repo — §0.17):**

| Test | File:line | Enforces |
|---|---|---|
| `TranslatedFile_HasIdenticalKeySet_AsEnglish` | `Clinqet.API.UnitTests\Localization\LocalizationResourceTests.cs:77-91` (`[InlineData]` fr/es/hi/gu :78-81) | exact key set |
| `TranslatedFile_PreservesAllPlaceholders` | same file :95-127 | `{0}`-style placeholder parity |
| `AllLocalizationFiles_ParseAsValidJson` | same file :130-135 | JSON validity |
| `GetLocalizedString_ResolvesEverySupportedLanguage_AndFallsBackToEnglish` | same file :162+ | runtime resolution |
| `EveryLiteralLocalizationKeyExistsInEnglishCatalog` | `Conventions\LocalizationSourceConventionTests.cs:25-53` | every literal `GetLocalizedString("…")` key exists in `en.json` |
| `UserFacingControllersContainNoLiteralFailuresOrEnglishLocalizationFallbacks` | same file :55-72 | no literal `ApiResponse.Fail("…")` / English `??` fallbacks |
| also present | `Localization\PostCompletionPayLocalizationTests.cs`, `Localization\TenancyLocalizationKeyTests.cs`, `Conventions\ValidationMessagePlaceholderTests.cs`, `Conventions\PermissionCatalogueLocalizationTests.cs` | |

**‼️ Note:** `VoiceAssistant:SupportedLanguages` is a DIFFERENT, LONGER list —
`[ "en", "fr", "es", "hi", "pa", "gu" ]` (`Clinqet.API\appsettings.json:171`), i.e. **six** including Punjabi
(`pa`), which has **no** localization catalogue file. Any answer-language logic must not conflate the two.

### B.2 Partner web (`C:\Nik\clinqetwebpartnerapp`)

| Item | Value |
|---|---|
| Files | `public\lang\{en-US,es-US,fr-CA,gu-IN,hi-IN}.json` |
| Keys | **5,929** leaf keys per file; parity **0/0** across all four translated files |
| Provider | `src\app\context\IntlContext.jsx:7-19` imports **`en-US, fr-CA, gu-IN, hi-IN` only** (`es-US` NOT loaded); same four in `src\app\global-error.js:8-11`. Locale persisted under `selectedLanguage` (`IntlContext.jsx:22, 36`) via `SessionStore` |
| Parity tests | `src\utils\localeParity.test.js:3-9` (loads all FIVE incl. `es-US`; ICU placeholder parity via `@formatjs/icu-messageformat-parser`), `src\utils\icuMessageIntegrity.test.js:7-10`, `src\utils\sourceLocalizationIntegrity.test.js:7-11`, `src\utils\p13LocaleParity.test.js`, `src\utils\routeKycLocaleParity.test.js`, `src\utils\businessRoleCatalogParity.test.js`, `src\app\dashboard\profile\dataDeletionNavKey.test.js:4-8` |

### B.3 Partner mobile (`C:\Nik\clinqetmobilepartnerapp`)

| Item | Value |
|---|---|
| Files | `src\Locales\{en,es,fr,gu,hi}.json` |
| Keys | **5,619** leaf keys per file; parity **0/0** |
| Provider | `src\Locales\i18n.ts:11-16` registers **`en, fr, gu, hi`** (comment :10 — "Spanish is fully authored but remains hidden until product approves picker integration"); `SUPPORTED_LANGUAGES = Object.keys(languageResources)` :18; `fallbackLng: 'en'` :43 |
| Parity tests | `src\Locales\localeParity.test.ts` — `LOCALES = { es, fr, gu, hi }` :7, `ALL_LOCALES` :8; exact English key set :38-40; real P4 translations :42-48; placeholder parity :49-54; **no inline ICU plural/select** :56-62; **double-brace `{{…}}` interpolation only** :64-70. Plus `src\Locales\sourceLocalizationIntegrity.test.ts` (scans `src/**` for raw copy) |

### B.4 Email/SMS template languages

`en, es, fr, gu, hi` — email 103 files each; SMS `en` 20 / others 1 (B.1). **No email template is needed for
Provider AI Search** (an in-app answer surface), so the cost of a new string is **15 JSON files**
(5 API + 5 web + 5 mobile), which matches PLAN §10.

---

## C. Search infra

### C.1 Client wiring, index names, per-region settings

| Host | Registration | Settings keys |
|---|---|---|
| **API** `C:\Nik\clinqetapi\Clinqet.API\Program.cs` | `AddSingleton<SearchClient>` (SERVICE index) **:954-966** — `new SearchIndexClient(new Uri(endpoint), new AzureKeyCredential(apiKey)).GetSearchClient(indexName)`; `AddSingleton<ProviderSearchClient>` **:971-983**; `AddSingleton<KnowledgeSearchClient>` **:987-999**. Wrappers exist because a second bare `SearchClient` would be unresolvable (comment :969-970) | `AISearch:Endpoint`, `AISearch:ApiKey`, `AISearch:IndexName` / `:ProviderIndexName` / `:KnowledgeIndexName` — each `?? throw` |
| **Functions** `C:\Nik\clinqetfuncations\Clinqet.Communications\Program.cs` | `SearchClient` **:605-617**, `ProviderSearchClient` **:622-634**, `KnowledgeSearchClient` **:860-872**; also injected nullable at **:468** (`sp.GetService<SearchClient>()`) | same |
| **MCP** `C:\Nik\clinqetmcp\Clinqet.Mcp\Program.cs` | reads config **:244-246**, builds `catalogSearchClient` **:269-272** and `KnowledgeSearchClient` **:282-288** — **NULL when a stamp lacks Search/Foundry**, and the tools degrade honestly (comment :240-243) | `AISearch:Endpoint/ApiKey/IndexName/KnowledgeIndexName` (no provider index) |

- Config: API `appsettings.json:736-742` (`IndexName "clinket-dev"`, `ProviderIndexName "clinket-providers-dev"`,
  `KnowledgeIndexName "clinket-knowledge-dev"`, `MaxRetryAttempts 3`, `RetryDelays "1,2,4"`);
  per-stamp `Endpoint` + `ApiKey` in `appsettings.ca.json:17-22` / `appsettings.in.json:20-25` (loaded only when
  `CLINKET_REGION` is set — `Program.cs:102-108`; env vars layered last :112). **Neither regional file overrides
  `KnowledgeIndexName`** (:17-22 / :20-25 carry only Endpoint/ApiKey/IndexName/ProviderIndexName) — the base
  value is used, which is correct because index names are identical per stamp and only the SERVICE differs.
  Functions `appsettings.json:385-389`; MCP `appsettings.json:136-139`.
  `AzureSearchIndex:VectorSearchDimensions 3072` (`appsettings.json:2002`).
- Deploy: `$searchIndexName = "clinket$envResourceSuffix"` (`deploy.ps1:1603`),
  `$providerSearchIndexName` (:1604), `$knowledgeSearchIndexName` (:1605);
  `$script:searchEndpoint = "https://$SearchServiceName.search.windows.net"` (:6813), **blank** when the stamp
  is unprovisioned (:6820, WARN :6822). Pushed as `AISearch__Endpoint/ApiKey/IndexName/ProviderIndexName/
  KnowledgeIndexName` to Functions (:6955-6957, :7005-7007 and :7823-7827), API (:7161-7165 and :7583-7587)
  and MCP (`$mcpAzureSettings` from :8197).
- Alias vs physical: `cosmosindexsetup\Program.cs:48-50` — comment "the physical index is
  `{IndexName}{envSuffix}-{IndexVersion}` and the ALIAS takes the plain name", `IndexVersion = "v1"` :50;
  env suffixing :993-994; physical names computed :1014-1016; alias repoint + assert :1018-1022, :1107-1111.
  Two synonym maps: `SynonymMapName = "clinket-synonyms"` :51, `KnowledgeSynonymMapName =
  "clinket-knowledge-synonyms"` :60.
- SDK: `Azure.Search.Documents` **12.0.0** (`C:\Nik\clinqetcore\Clinqet.Core.csproj:10`;
  `cosmosindexsetup\ClinqetCosmosAIIndexSetup.csproj:9`). Explicit `SearchClientOptions` / `ServiceVersion`:
  **NOT FOUND** ⇒ SDK default API version.
- Resource: `C:\Nik\azureautomation\ai.json:88-105` — `Microsoft.Search/searchServices` api `2023-11-01`,
  SKU from a parameter (default `basic`), `replicaCount 1`, `partitionCount 1`,
  `authOptions: { apiKeyOnly: {} }`, `semanticSearch: "free"` (disabled only on the `free` SKU).

**‼️ Build-failing search guards a new query MUST satisfy** (all in `Clinqet.API.UnitTests\Conventions\`,
scanning this repo plus the shared LIBRARIES `clinqetinfrastructure` + `clinqetcore` only —
`SearchProjectionConventionTests.cs:25-30`):

| Test | File:line | Enforces |
|---|---|---|
| `EveryServiceDocumentQuery_ProjectsAnExplicitFieldSet` | `SearchProjectionConventionTests.cs:49-97` | **every `SearchAsync<ServiceSearchDocument>` that retrieves documents must populate `Select`** (a `Size = 0` count/facet query is exempt, :44-47). An un-projected read returns the 3072-dim `textEmbedding` on every hit AND the non-nullable value-type fields that throw when Azure returns them null (:10-15) |
| `LandingProjection_*` (4 tests) | same file :99-180 | the SEO landing projection names only real fields, has no non-nullable value types, covers every field the mapping reads, and has no unused field |
| `EveryLiteralOrderByField_IsSortableOnThatIndexsModel` | `SearchOrderByIsSortableConventionTests.cs:31-42` | every `$orderby` field is `IsSortable` on the index model, or Azure 400s the WHOLE query (:11) |
| `EveryRankingSignalTheComposerReads_IsActuallySelected` | `SearchSelectFieldsConventionTests.cs:32-56` | "the inert-fix guard" (:7) — a ranking signal read by the composer must be in the `Select` |
| `ProviderDocument_*` (7 tests) | `ProviderIndexConventionTests.cs:20-143` | provider-index field flags + no non-nullable value types + `SchemaVersion` bumped for new fields |

### C.2 SERVICE index schema — the citation-breadcrumb fields

`C:\Nik\clinqetcore\Entities\AISearch\SearchDocument.cs` (591 lines), class `ServiceSearchDocument` :9-450:

| Field | Line | Declared flags |
|---|---|---|
| `id` (key) | :11-13 | key, filterable |
| **`serviceId`** | :15-17 | filterable, sortable |
| **`serviceName`** | :19-21 | **searchable**, filterable, sortable |
| `serviceDescription` | :23-25 | searchable |
| `serviceImages` (`IndexedImage{original,thumb,medium,width,height}`) | :27-29 (+ class :452-473) | retrievable complex |
| **`isActive`** | :31-33 | filterable |
| **`isListed`** (from `BusinessProfile.IsListed`) | :38-40 | filterable |
| `allowOnlineBookings` | :44-46 | filterable |
| `priceType` / `fixedPrice` / `startPrice` / `maxPrice` / `hourlyRate` / `minimumCharge` / `currency` | :138-164 | filterable (+ sortable/facetable per line) |
| **`categoryId`** | :174-176 | filterable |
| **`categoryName`** | :178-180 | **searchable**, filterable, facetable |
| `categoryDescription` | :182-184 | searchable |
| **`subcategoryId`** | :186-188 | filterable |
| **`subcategoryName`** | :190-192 | **searchable**, filterable, facetable |
| `subcategoryDescription` | :194-196 | searchable |
| **`businessId`** — the tenant scope | :198-200 | filterable |
| `businessStatus` (`eq 'Active'` defence) | :206-208 | filterable |
| `businessFriendlyName` (Open Page slug; comment :210-211) | :212-214 | retrievable |
| `businessName` | :216-218 | searchable, filterable, sortable |
| `durationMinutes` | :343-345 | filterable, sortable |
| `tags` · `searchKeywords` · `synonyms` · `alternativeNames` · `broadMatchTerms` · `commonSearchPhrases` · `userIntentPhrases` | :352-377 | searchable (AI enrichment) |
| `textEmbedding` | :379-381 (+ `cosmosindexsetup\Program.cs:574-583`) | vector, 3072 dims, HNSW profile `textVectorProfile` |
| `updatedAt` / `updatedAtTicks` (hidden) / `hasEmbedding` (hidden) | :416-432 | filterable |

- **`approvalStatus`: NOT in the index.** `Service.ApprovalStatus` exists only in Cosmos
  (`Cosmos.cs:459-462`); the index has `isActive` / `isListed` / `businessStatus` only.
- **Per-service slug: NOT FOUND** (there is a BUSINESS slug `businessFriendlyName`).
- Index definition `cosmosindexsetup\Program.cs:238-640` — vector config :244, :265; suggester
  `service-suggester` :246 over `SearchSuggesterFields.SourceFields`
  (`C:\Nik\clinqetcore\Utilities\SearchSuggesterFields.cs:10-20` = `serviceName, searchKeywords, synonyms,
  subcategoryName, categoryName, tags, businessName, serviceDescription`); scoring profiles
  `ServiceRelevance` :343, `ServiceRelevanceWithLocation` :395, **`voiceCatalogScoring` :221, :432**,
  `vectorPure` :457; all four attached :617 with `DefaultScoringProfile = ServiceRelevance` :618;
  synonym map attached per field :521.
- **KNOWLEDGE index** — `C:\Nik\clinqetcore\Entities\AISearch\KnowledgeSearchDocument.cs:11-…`:
  `id` :16-18 (key, filterable, sortable) · **`businessId`** :21-23 (filterable) · `docId` :26-28 (filterable) ·
  `docName` :30-32 (searchable) · `docType` :38-40 (searchable, filterable, facetable) ·
  `linkedServiceIds` :45-47 (filterable) · `linkedServiceNames` :53-55 (searchable) ·
  `linkedGroupName` :61-63 (searchable) · **`sectionTitle`** :65-67 (searchable) · `content` :72-74 (searchable) ·
  `contentVector` :80 (3072) · **`docTitle`** :84-86 (searchable) · `chunkKind` :88-90 (filterable, facetable) ·
  **`pageNumber`** :92-94 (**plain `SimpleField` — retrievable only, NOT filterable/sortable**) ·
  `language` :96-98 (filterable) · `updatedAt` :100-102 · `hasEmbedding` :106-108 (hidden) ·
  **`imageRef`** :115-116. Definition `cosmosindexsetup\KnowledgeSearchIndexInitializer.cs` (179 lines):
  `content`/`sectionTitle`/`docTitle`/`linkedServiceNames`/`docType`/`linkedGroupName` = `en.microsoft`
  (:14-18, :35-41), TextWeights-only `knowledgeRelevance` :95-108 (`docTitle` 3.0 :102), semantic config
  title `docTitle` :148, `contentVector` :123-132, index assembled :140-157. **No suggester.**
- **Tenant filter used today (the template to copy)** —
  `C:\Nik\clinqetinfrastructure\Services\Voice\ProviderCatalogSearchService.cs` (890 lines):
  `ScoringProfileName = "voiceCatalogScoring"` :24; `SelectFields` :48-55 =
  `businessId, serviceId, serviceName, serviceDescription, categoryName, subcategoryName, priceType,
  fixedPrice, startPrice, maxPrice, hourlyRate, durationMinutes` with the comment **"businessId is selected
  so every row can be verified — never removed"** (:50); `BuildScopeFilter(businessId)` :570-571 /
  `BuildLookupFilter` :573-575 + `AssertScoped(filter, businessId)` :94, :267, :332, :421 (impl :624);
  `QueryType = SearchQueryType.Full` + `ScoringProfile` :273-276, :367-369; facets on `subcategoryName` /
  `categoryName` :373-374; semantic escalation :380; **every hit's `businessId` re-checked and the WHOLE result
  set discarded + `_alarm.RaiseCrossTenantLeak(...)` on mismatch** :288-293, :445.
  Knowledge: `C:\Nik\clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` (861 lines):
  `SearchFields` :49-51; **`SelectFields` :52-56** = `id, businessId, docId, docName, docTitle, sectionTitle,
  content, linkedServiceIds, linkedServiceNames, chunkKind, docType, linkedGroupName`;
  `ImageRefField = "imageRef"` :61 — added to `Select` at **:143 and :431 UNCONDITIONALLY** (the comment
  :58-60 still describes a kill switch that gated it, and warns that **"selecting a field an index does not
  declare is a query-time 400 on EVERY search"**); **`RefSelectFields` :64-65** (the by-id read for sends) =
  `id, businessId, docId, docName, docTitle, sectionTitle, content, chunkKind, **pageNumber**`;
  scope filter :131-132 (impl :672-698), by-id filter `businessId eq '…' and search.in(id, '…', '|')` :291-294,
  `AssertScoped` :132, :292, :700-702; cross-tenant alarm :308, :508;
  `ScoringProfile = SearchScoringProfiles.KnowledgeRelevance` :139; `RetrievalWindowFactor = 2` :70;
  `SemanticRankerEnabled` ships OFF (measured 88.5% → 83.6%, comment :145-147).

  **‼️ `pageNumber` is NOT in the main retrieval `SelectFields`** — only in `RefSelectFields`. A page-numbered
  citation from the primary retrieval path needs either (a) `pageNumber` added to the retrieval select, or
  (b) the by-id read. See F.1 #4.

### C.3 Category model, the cached lookup, and localized names

- Entity `C:\Nik\clinqetcore\Entities\COSMOS\Cosmos.cs:336-370` (container **`ProviderData`**, per
  `CategoryRepository` ctor `configuration["CosmosDb:ContainerNames:ProviderData"] ?? "ProviderData"` :30):
  `CategoryId` :338-339 · `Name` :341-342 · **`ParentCategoryId`** :344-345 (subcategory ⇔ non-null) ·
  `IsCustom` :347-348 · `IconURL` :350-351 · `BusinessId` :353-354 · `Approved` :356-357 ·
  `DisplayOrder` :359-360 · `Description` :362-363 · `IsActive` :365-366 ·
  **`FullPath`** :368-369 (`// e.g., "Appliance Services > Washing Machine"`).
  Per-business denormalised selections `SelectedCategory` :372-388 (`categoryId`, `categoryName`,
  `categoryIconURL`), `SelectedSubcategory` :390-403 (`subCategoryId`, `subCategoryName`,
  `subCategoryIconURL`, `serviceCount`).
- Repository `C:\Nik\clinqetinfrastructure\Data\COSMOS\CategoryRepository.cs` (998 lines):
  `GLOBAL_BUSINESS_ID` from config, default `"global"` (:34);
  **`GetGlobalCategoriesAsync` :75-105** goes through `_cacheService.GetOrSetGlobalCategoriesAsync` and, on
  miss, queries `WHERE {TypeFilterSql} AND c.businessId = @businessId AND c.isActive AND c.approved
  ORDER BY c.displayOrder, c.name` with `GetItemsAsync(queryDefinition, GLOBAL_BUSINESS_ID, …)` —
  **partition-scoped** (:86-97);
  `GetAvailableCategoriesAsync(businessId)` :46-54 = global + custom;
  **`GetCategoryByIdAsync(categoryId, businessId)` :150-185** — a global **point read**
  (`GetItemAsync(categoryId, GLOBAL_BUSINESS_ID)` :169), then a business-partition point read if provided
  (:178) — both partition-scoped, no cross-partition query;
  `GetCustomCategoriesAsync` :110 · `GetSubcategoriesAsync(parentId, businessId)` :700 ·
  `GetGlobalSubcategoriesAsync(parentId)` :740; cache invalidated on mutation :305, :364, :458, :684.
- Cache `C:\Nik\clinqetcore\Interfaces\Services\ICategoryCacheService.cs:5-12`;
  `C:\Nik\clinqetinfrastructure\Services\CategoryServices\CategoryCacheService.cs` (131 lines):
  TTL `CategoryCache:GlobalCategoriesCacheDurationHours` default **24** (:39) ·
  key prefix `CategoryCache:CacheKeyPrefix` default **`GlobalCategories`** (:40) ·
  `MemoryCacheEntryOptions { Priority = CacheItemPriority.High, **Size = 1** }` (:84-85) ·
  generation counter `_generation` :23 with a write gate so an in-flight fetch never re-caches a list an admin
  just invalidated (:67, :74, :114). Config `appsettings.json` `CategoryCache` block near :1964-1969.
- **LOCALIZED CATEGORY NAMES: NOT FOUND (re-verified).** A repo-wide grep for
  `LocalizedName|NameTranslations|CategoryTranslation|Translations` across `clinqetcore\Entities`,
  `clinqetshared\DTOs` and `clinqetinfrastructure\Services\CategoryServices` returns **zero** hits.
  `Category` has a single `Name`; `CategoryRepository` uses `ILocalizationService` only for error messages.
  **A breadcrumb renders the authored (English) category/subcategory name in every UI language.**

### C.4 Service entity, image shape, and the edit routes (RESIDUAL ITEM CLOSED)

- Entity `C:\Nik\clinqetcore\Entities\COSMOS\Cosmos.cs:405-475` (`Service : ProviderOwnedEntity`, container
  `ProviderData`): `ServiceId` :407-408 · `BusinessId` :410-411 · **`CategoryId`** :413-414 ·
  **`SubcategoryId`** :416-417 · `Name` :419-420 · `Description` (`List<string>`) :422-423 ·
  `ServiceImages` :425-426 · `Pricing` :428-429 · `ServiceAreaIds` :431-432 · `IsActive` :434-435 ·
  `DisplayOrder` :437-438 · `Duration` :440-441 · `IsAtStore` / `IsAtCustomersLocation` :443-447 ·
  `IsDeleted` :449-450 · `AcceptsOnlinePayments` :453-454 · `Taxable` :456-457 ·
  **`ApprovalStatus`** (`ServiceApprovalStatus?`, default `PendingApproval`) :459-462 ·
  `ApprovalRejectionReason` / `ApprovedAt` / `ApprovedBy` :464-471 · `TTL` :473-474.
  `ServiceDuration` :477+. `Pricing` :488-560+: `PriceType` :491-492 · `FixedPrice` :495-496 ·
  `StartPrice`/`MaxPrice` :498-502 · `HourlyRate`/`MinimumHours` :504-508 · `MinimumCharge` :511-512 ·
  visit/distance charges :515-534 · tax :537-541 · discount :544-554 · `Currency` :556-557.
- `ServiceImage` — **`C:\Nik\clinqetshared\Models\ServiceImage.cs`** (59 lines, NOT in clinqetcore):
  `ImageId` :11-13 · `Name` :15-16 · `Url` :18-19 · `SizeBytes` :21-22 · `Extension` :24-25 ·
  `ContentType` :27-28 · `UploadedAt` :30-31 · `ThumbnailUrl` :33-35 · `MediumUrl` :37-39 ·
  `Width`/`Height` :41-47 · `ProcessingStatus` :49-53 · `ProcessedAt` :55-57.
  `serviceimages` is a **PUBLIC** container (`appsettings.json:2650`; `storage.json:664/673`) ⇒
  `TransformToPublicUrl` yields a bare FD URL with **no SAS**.
- **Partner web edit route — CONFIRMED WORKING:**
  - Route constants `C:\Nik\clinqetwebpartnerapp\src\routes\routeConfig.jsx`:
    `AiKnowledge: "/dashboard/profile/knowledge"` :86, **`ManageServicesPrice:
    "/dashboard/profile/manage-services-price"` :91**. There is **NO `/dashboard/services` route** —
    `src\app\dashboard\` contains `activity, ai-billing, analytics, billing, bookings, calendar,
    call-follow-ups, customers, explore, inbox, invoices, leads, myQuotes, notifications, profile,
    refund-requests, team` and nothing named `services`.
  - Page `src\app\dashboard\profile\manage-services-price\page.jsx:1-18` renders
    `<SurfaceGate surface="services"><ManageServicesPrice navigationNotShow entryContext="profile" /></SurfaceGate>`.
  - **The component is now a FOLDER**: `@/components/onboarding/add-business-information/ManageServicesPrice`
    resolves to `…\ManageServicesPrice\index.jsx` (37,448 bytes). A tracked legacy
    `…\ManageServicesPrice.jsx.backup` also exists in git (`git ls-files`) — dead weight, not the live component.
  - **`?serviceId=` IS consumed** — `ManageServicesPrice\index.jsx`: `useSearchParams` imported :5, called :60;
    the deep-link effect **:201-244**: reads `serviceId` :202 and `businessId` :203; bails unless
    `entryContext === "profile"` :204; dedupes with `handledDeepLink` / `deepLinkInFlight` refs :206-207;
    **switches workspace** via `switchBusiness(targetBusinessId)` when `businessId` differs from
    `activeBusinessId` :209-226 (falling back to a clean `router.replace` on failure); then
    `router.replace(ProfileRoute.ManageServicesPrice)` to strip the query :230 and
    `handleAddService(null, null, { serviceId: targetServiceId })` :232 when `editable`.
    `handleAddService` fetches the full row via `fetchServiceById(service.serviceId)` :176-178.
  - Deep-link builder `src\utils\notificationNavigation.js:15-20`:
    `serviceRoute(serviceId, context)` → `${ProfileRoute.ManageServicesPrice}?serviceId=…[&businessId=…]`.
- **Partner mobile edit route — CONFIRMED WORKING (earlier "NOT FOUND" was measuring the wrong screen):**
  - URL deep links `C:\Nik\clinqetmobilepartnerapp\src\appNavigation\linking.ts`: prefixes = the partner hosts
    + `clinketpartner://` (:22-31); `Knowledge: 'dashboard/profile/knowledge'` :104;
    `ManageService: 'dashboard/profile/manage-services-price'` :115. Screen constants
    `appNavigation\constant.tsx`: `MANAGESERVICE: 'ManageService'` :21, **`ADDSERVICE: 'AddService'` :22**,
    `KNOWLEDGE: 'Knowledge'` :140.
  - `Screen\completeProfileFlow\ManageService\index.tsx` (936 lines) — the LIST screen — reads **no**
    `route.params` / `useRoute` (confirmed NOT FOUND); it navigates to `AddService` for an edit at :361.
  - **`Screen\completeProfileFlow\AddService\index.tsx`** (1,495 lines) — the EDIT screen — declares
    `route?.params?: { selectedCategories?, **serviceId?**, **businessId?**, **entryContext?: "onboarding" | "profile"** }`
    **:126-136**, destructures them at **:155-161** (`serviceId: deepLinkedServiceId`,
    `businessId: deepLinkedBusinessId`, `entryContext = "profile"`), hydrates via
    `getServiceByIdApi(deepLinkedServiceId)` **:939-944**, and **switches workspace** when
    `deepLinkedBusinessId !== activeBusinessId` **:1100-1101** before loading (:1115-1121);
    the edit-mode chrome renders on `Boolean(deepLinkedServiceId)` :1266.
    `editable = entryContext === "onboarding" || serviceCatalogEditable(can, access !== null)` :162.
  - Deep-link builder `src\Util\notificationNavigation.ts:36-46`:
    `serviceRoute(serviceId, businessId)` → `{ screen: 'AddService', params: { serviceId, businessId?,
    entryContext: 'profile' } }`, falling back to `{ screen: 'ManageService' }` with no id.
  - **`AddService` is registered as a stack screen in four navigators** (`AboutBusiness-Route.tsx:39`,
    `Booking-Route.tsx:35`, `Broadcast-Route.tsx:31`, `MyDashboard-Route.tsx:133`) but is **NOT in
    `linking.ts`** ⇒ reachable by in-app `navigation.navigate(...)` only, never by a URL. That is exactly what
    an in-app citation card needs.
- Web image helpers (reusable for answer picture tiles) —
  `C:\Nik\clinqetwebpartnerapp\src\utils\mediaDerivative.js`: `getSourceChain` :32 · `getThumbSrc` :43 ·
  `getMediumSrc` :45 · `getOriginalSrc` :47 · `getViewerChain` :51 · `getPosterSrc` :61.
  Used by `src\components\Profile\knowledge\KnowledgeImagesPanel.jsx:19, 258` (lightbox slides) — which is why
  `KnowledgeDocumentImageDto` deliberately names its members `ThumbnailUrl` / `Url`
  (`KnowledgeDtos.cs:112-120`).

---

## D. Deployment plumbing

### D.1 How AI settings reach each host (`C:\Nik\azureautomation\deploy.ps1`, 9,079 lines)

**‼️ TWO Foundry accounts, not one:**

| Account | Where | Models | Lines |
|---|---|---|---|
| `$SHARED_AI_FOUNDRY_FULL_NAME` = `clinket-ai-foundry-<tier>-eastus2` | **East US 2** (`$AI_FOUNDRY_LOCATION`) | ALL six in `$modelDeployments` — chat, luna, embedding, both realtime tiers, transcribe | ctor `:1337`; PRE-PHASE C `:2645-2686`; `$modelAccountName = $SHARED_AI_FOUNDRY_FULL_NAME` `:2695`; endpoint `:2971`; keys `:2972` |
| `$INDIA_AI_FOUNDRY_FULL_NAME` = `clinket-ai-foundry-<tier>-swedencentral` | **Sweden Central** (`$INDIA_AI_FOUNDRY_LOCATION` `:854`) | **VOICE ONLY** — `$indiaRealtimeModels` `:3028-3032` = `gpt-realtime-mini`, `gpt-realtime-2`, `gpt-4o-mini-transcribe` | ctor `:1340`; **PRE-PHASE C2 `:3013-3104`**, runs only when the `in` stamp is in scope `:3013`; RAI attach `:3060-3070`; endpoint `:3080`; keys `:3081` |

The C2 comment `:3005-3009` is explicit: *"This account holds ONLY the voice models (gpt-realtime-* + the
transcription sidecar); **chat/embedding/reasoning/summary stay on the shared East US 2 account for every stamp
(incl. IN)**"*, and quota failures there are WARN-not-fail. So **a Provider AI Search text flow uses the shared
East US 2 account in every stamp** — no per-region model decision to make.
Region lock: `$openAiModelSetSupportedRegions = @("East US 2")` `:1522`; any other `$OpenAiLocation` throws
`:1526-1527`. `ai-foundry.json` (59 lines) is the shared template for BOTH accounts — note its own metadata
`:5` still says *"ONE AI Foundry account per environment-tier … pinned to East US 2"*, which is now stale for
the India account (`openAiLocation` is a parameter, `:8-14`; final name = `{base}-{locationSlug}` `:22-24`).

**Constants** (`deploy.ps1`): `$modelApiVersion = "2024-10-01"` :2696 ·
`$openAiPrimaryDeploymentName = "gpt-5.4-mini"` :2703 · `$openAiLunaDeploymentName = "gpt-5.6-luna"` :2709 ·
`$openAiEmbeddingDeploymentName = "text-embedding-3-large"` :2710 ·
`$openAiRealtimeDefaultDeploymentName = "gpt-realtime-mini"` :2716 ·
`$openAiRealtimePremiumDeploymentName = "gpt-realtime-2"` :2717 ·
`$openAiRealtimePremiumPreviousName = "gpt-realtime-1.5"` :2720 ·
`$openAiTranscribeDeploymentName = "gpt-4o-mini-transcribe"` :2722 ·
`$openAiChatApiVersion = "2025-01-01-preview"` :2723 ·
`$openAiEmbeddingApiVersion = "2024-12-01-preview"` :2724 ·
`$openAiEmbeddingDimensions = 3072` :2725 · `$realtimeCapacityEffective` :2732-2737 ·
`$contentFilterName = "ClinketContentFilter"` :2909.

**App-settings blocks carrying AI keys** — all written by `Merge-AppSettings` (`:1750-1795`), a
read-merge-PUT over `config/appsettings` that **never removes** a key; `Assert-RequiredAppSettings` at `:1801`:

| Block | Host | Start | AI keys |
|---|---|---|---|
| `Merge-AppSettings $FunctionsResourceGroup $FunctionAppName @{…}` (PHASE 4b) | Functions | :6861 | `AISearch__Endpoint/ApiKey` :6955-6956 · `AzureAIFoundry__*` :6957-6961 · `AIService__ApiKey/DeploymentName` :6963-6964 · `ServiceApproval__*DeploymentName` :6971-6972 · `SearchIndexEnrichment__DeploymentName` :6973 · `VoiceCall__SummaryDeploymentName` :7001 · `AISearch__IndexName/ProviderIndexName/KnowledgeIndexName` :7005-7007 · `AzureDocumentIntelligence__*` :7012, :7015 · `Voice__ExpertCheck__DeploymentName` :7018 · `VoiceCall__TranslationDeploymentName` :7020 · `ClinketApi__BaseUrl` :7023 · `StorageConfiguration__AccountUrl/FrontDoorBaseUrl` :6975-6976 |
| `Merge-AppSettings $AppsResourceGroup $ApiAppName @{…}` (**PHASE 4c**, banner :7140) | **API** | :7143 | `AISearch__*` **:7161-7165** · `AzureAIFoundry__*` **:7166-7170** · `AIService__ApiKey/DeploymentName` **:7172-7173** · **per-flow** `Search__SpellCheck__Llm__DeploymentName` :7175 · `SearchIndexEnrichment__DeploymentName` :7176 · `AzureDocumentIntelligence__AiDeploymentName` :7177 · `BroadcastClassification__AiDeploymentName/VisionDeploymentName` :7178-7179 · `AzureDocumentIntelligence__VisionAiDeploymentName` :7180 · `StorageConfiguration__AccountUrl/FrontDoorBaseUrl` :7228-7229 |
| `$apiSettings = [ordered]@{…}` | **API** | :7570 | same set **:7583-7602**; `Mcp__*` KV refs :7702-7704 |
| `$functionAppSettings = [ordered]@{…}` | Functions | :7738 | `AISearch__*` :7823-7827 · `AzureAIFoundry__*` :7831-7835 · `AIService__*` :7837-7838 · `AzureDocumentIntelligence__AiDeploymentName` :7830 |
| `$mcpAzureSettings = [ordered]@{…}` | MCP | :8197 | `Azure__Realtime__DeploymentDefault` :8225 (+ the MCP `AISearch`/Foundry keys in the same block) |

- **Secrets posture:** `AIService__ApiKey`, `AzureAIFoundry__ApiKey` and `AISearch__ApiKey` are written as
  **PLAIN values** (`$openAiKeys.Key1`, `$searchKeys.primaryKey` — e.g. :7162, :7167, :7172; :7584, :7589,
  :7594). `Resolve-KeyVaultSecretRef` (`:2010-2020`) is used only for WhatsApp / Stripe / Razorpay /
  realtime-webhook secrets (`:5476-5521, 5697-5786`), `JwtSettings__SecretKey` (`:5467`) and `Mcp__*`
  (`:7702-7704, 7909-7910`). The **PHASE 4e Key Vault reference gate is MCP-only** (`:8085-8364`): per-key
  `GET …/config/configreferences/appsettings/<key>` (`:8346`) inside a recycle-and-recheck loop
  (`:8357`) that hard-throws with per-key diagnostics (`:8364`); API/Functions/Identity hold vault-wide
  Secrets User via `keyvault.json`.
- **Required-key assertions:** `$script:RequiredApiAppSettings` `:1831-1853` — **no AI key is required today**
  (it lists `LocaleSettings__FallbackCountryCode`, `Discovery__DefaultCurrency`, `HealthChecks__Sms__Provider`,
  `CosmosDb__Endpoint`, `ServiceBusSettings__FullyQualifiedNamespace` + two queue names,
  **`StorageConfiguration__AccountUrl`**, `AnalyticsSettings__StorageAccountUrl`, `Identity__BaseUrl`,
  three `Email__*`, `IndexNow__Enabled/Host`, `WhatsApp__WabaLanguages`);
  `RequiredIdentityAppSettings` `:1855-1864`; `RequiredFunctionAppSettings` `:1865-1928` (includes
  `VoiceCall__SummaryDeploymentName` `:1925`); `RequiredMcpAppSettings` `:1929-1935` (includes
  `Voice__ExpertCheck__DeploymentName` `:1934`).
- **Per-flow seam in code:** `AICompletionService.SendCompletionAsync(..., string? deploymentName, …)`
  (`C:\Nik\clinqetinfrastructure\Services\AI\AICompletionService.cs:233, 259, 293, 320, 352`) resolves
  `var deployment = deploymentName ?? _settings.DeploymentName` (**:363**). Models that reject `temperature`
  are listed in `AIService:DefaultTemperatureOnlyDeployments` (`appsettings.json:2017` = `["gpt-5.6-luna"]`;
  class default `AIServiceSettings.cs:24` = `[AiModels.Luna]`).
  Constants `C:\Nik\clinqetshared\Constants\AiModels.cs:7-14` — `Mini = "gpt-5.4-mini"` :11,
  `Luna = "gpt-5.6-luna"` :13, with the warning at :5-6 that *"a deployment that is not in `$modelDeployments`
  is never visited by the RAI assignment loop and therefore serves with NO content filter"* and at :9-10 that
  the host default is locked to Mini because *"gpt-5.6 cannot do tool calls on Chat Completions"*.
  Sub-flow attribution ids: `C:\Nik\clinqetshared\Constants\AiSubFlows.cs:7-40` — a lettered scheme
  `A1…H3` (`A1-text-enhance` … `H3-transcript-translate`) plus `Unattributed = "unattributed"` :39;
  **no convention test pins this list** (grep of `Conventions\` for `AiSubFlows` = 0 hits).
- **Convention tests (API repo, this host's appsettings only — header `:11-19`):**
  `Conventions\AiModelPinConventionTests.cs` — host default `AIService:DeploymentName` MUST stay
  `AiModels.Mini` **:55-60**; `LunaPins` dictionary **:63-75** (11 entries: A1 TextEnhancement, A2
  Search:SpellCheck:Llm, C2/C3 BroadcastClassification Ai/Vision, D2/D3 AzureDocumentIntelligence:Ai,
  D1 :VisionAi, E1-E4 ProviderAttachmentProcessing Images Caption/Proposer/ServiceVerify/ProfileVerify,
  **D4 Vision:TranscribeDeploymentName**) driving the theory **:77-86**;
  `SearchIndexEnrichment:DeploymentName` stays Mini **:88-93**; latency dials never null **:97-106**
  (`BroadcastClassification:VisionReasoningEffort = "Low"`, `Search:SpellCheck:Llm:ReasoningEffort = "None"`);
  file-size gates move together :108-117; changed limits :118-129;
  **`appsettings.ca.json` / `appsettings.in.json` must match the base decision :130-150**.
  `Conventions\AiTokenPricingConventionTests.cs:13-29` — `AIService:TokenPricing`
  (`appsettings.json:2030-2035`) and `AIServiceSettings.TokenPricing` class defaults
  (`AIServiceSettings.cs:29-35`) must list the SAME models with the SAME `InputPer1M` /
  `CachedInputPer1M` / `OutputPer1M`, **both ways** (mini 0.75/0.075/4.50 · luna 0.20/0.02/1.20 ·
  gpt-5.4 2.50/0.25/15.00 · gpt-4.1 2.00/0.50/8.00).
- **Per-stamp API overrides that already exist:** `appsettings.ca.json` / `appsettings.in.json` carry
  `AISearch` (Endpoint/ApiKey/IndexName/ProviderIndexName), `AzureAIFoundry`, `AIService`,
  `Search:SpellCheck:Llm`, `SearchIndexEnrichment`, `AzureDocumentIntelligence`, `BroadcastClassification`.

### D.2 Model deployments declared today (`deploy.ps1:2739-2748`)

| Deployment | Model | Version | Capacity (K TPM) | Upgrade | Notes |
|---|---|---|---|---|---|
| `gpt-5.4-mini` | gpt-5.4-mini | `2026-03-17` | `$OpenAiModelCapacity` = **1000** (:527) | `OnceNewDefaultVersionAvailable` | host default (`AiModels.Mini`) — the ONLY tool-calling model |
| `gpt-5.6-luna` | gpt-5.6-luna | `2026-07-09` | 1000 | `OnceNewDefaultVersionAvailable` | per-flow candidate (`AiModels.Luna`); **no tool calls on Chat Completions** (`AiModels.cs:9-10`) |
| `text-embedding-3-large` | text-embedding-3-large | `1` | 1000 | `NoAutoUpgrade` | 3072 dims (:2725) |
| `gpt-realtime-mini` | gpt-realtime-mini | `2025-12-15` | `$realtimeCapacityEffective` — 60 non-prod / 100 prod (:530, :2732-2737) | `NoAutoUpgrade`, `preserveIfExists` | voice default |
| `gpt-realtime-2` | gpt-realtime-2 | `$OpenAiRealtimePremiumModelVersion` = `2026-05-07` (:533) | same | `NoAutoUpgrade`, `preserveIfExists` | voice premium; fallback `gpt-realtime-1.5` (:2720) |
| `gpt-4o-mini-transcribe` | gpt-4o-mini-transcribe | `2025-12-15` | `$OpenAiTranscribeModelCapacity` = **50** (:536) | `NoAutoUpgrade`, `preserveIfExists` | fallback literal `whisper-1` (:2905) |

Mechanics: REST PUT per deployment
(`…/Microsoft.CognitiveServices/accounts/{acct}/deployments/{name}?api-version=2024-10-01`, loop `:2825-2826`,
`preserveIfExists` short-circuit `:2834`); SKU ladder `GlobalStandard → DataZoneStandard → Standard`
(`$OpenAiDeploymentSkuLadder` :539) with capacity step-down on quota errors and immediate SKU abandonment on
availability errors (`Invoke-ModelDeploymentLadder` :2760+, `$script:ModelSkuUnavailablePattern` :2758);
DataZoneStandard bills **~10% above** GlobalStandard (:2866). `ClinketContentFilter` RAI policy created at
`:2909-2999` (`$filterPath` :2912; per-deployment attach `:2945`) and applied to **every name in
`$modelDeployments`** — plus, for the IN stamp, to the three India voice deployments (`:3060-3070`).
`gpt-5.4` and `gpt-4.1` are no longer deployed but keep pricing rows.

### D.3 Checklist — add a new AI **model deployment** used by `Clinqet.API`

1. **`deploy.ps1:2703-2725`** — add `$openAi<Flow>DeploymentName = "<deployment>"`.
   **`deploy.ps1:2739-2748`** — add an entry to `$modelDeployments`
   (`name`, `modelName`, `version`, `capacity`, `upgrade`, optional `preserveIfExists`).
   **MANDATORY:** a deployment outside that array is never visited by the RAI loop (`:2825`, `:2945`) and
   therefore serves with **no content filter** (`AiModels.cs:5-6`). Confirm the model is offered in
   **East US 2** on a ladder SKU (`:1522-1527`, `:539`).
2. **`deploy.ps1` API blocks** — add `"<Section>__<Key>DeploymentName" = $openAi<Flow>DeploymentName` in
   **BOTH** the PHASE 4c `Merge-AppSettings` block (`:7143+`, per-flow keys at `:7175-7180`) **and**
   `$apiSettings` (`:7570+`, per-flow keys at `:7597-7602`). Add to the Functions blocks
   (`:6971-7020`, `:7830`) or MCP (`:8197+`) **only if those hosts run the flow**. Add to
   `$script:RequiredApiAppSettings` (`:1831-1853`) only if a missing key must FAIL the deploy.
3. **`C:\Nik\clinqetshared\Constants\AiModels.cs:7-14`** — add the constant.
   **`C:\Nik\clinqetshared\Models\<Flow>Settings.cs`** — add
   `public string? <Flow>DeploymentName { get; set; } = AiModels.<New>;` (the class default MUST mirror
   `appsettings.json` — CLAUDE.md §0.12) and thread it through
   `AICompletionService.SendCompletionAsync(deploymentName: …)` (`AICompletionService.cs:352-363`).
   **NEVER repoint `AIService:DeploymentName`** (`AiModelPinConventionTests.cs:55-60`).
   Add a new **`AiSubFlows`** id (`AiSubFlows.cs:7-40`) so the per-call usage log attributes the spend.
4. **`C:\Nik\clinqetapi\Clinqet.API\appsettings.json`** — add `<Section>:<Key>DeploymentName`; mirror in
   `appsettings.ca.json` / `appsettings.in.json` if the flow is region-overridden
   (`AiModelPinConventionTests.cs:130-150` asserts the regional files match the base decision); add the pin to
   `LunaPins` (`:63-75`) or its own `[Fact]`.
5. **`appsettings.json:2030-2035` `AIService:TokenPricing` AND `AIServiceSettings.cs:29-35`** — add the model's
   `InputPer1M` / `CachedInputPer1M` / `OutputPer1M` on **both** sides or `AiTokenPricingConventionTests` fails
   (`:13-29`). An unlisted model still logs tokens but with **no cost estimate**. If the model rejects
   `temperature`, add it to `AIService:DefaultTemperatureOnlyDeployments`
   (`appsettings.json:2017`; `AIServiceSettings.cs:24`).
6. **No Key Vault change** — the Foundry endpoint/key are already PLAIN app settings shared by every deployment
   (`:7166-7173`, `:7588-7595`). **No `local.settings.json` / ARM change** unless a Functions TRIGGER consumes
   it (CLAUDE.md §4 / §25). **No new Azure resource** — the deployment is a child of the existing Foundry
   account, created by REST, not ARM.
7. **Health** — `HealthChecks` (`appsettings.json:654-677+`) covers Sql / Cosmos / BlobStorage / ServiceBus /
   SearchIndex and has **no AI-deployment probe**; consider one per CLAUDE.md §17.

### D.4 Checklist — add a new AI **settings key** (no new model) used by `Clinqet.API`

1. `Clinqet.API\appsettings.json` — add the key under its section; **class default must mirror it**
   (CLAUDE.md §0.12).
2. Decide whether it must be tunable per stamp. **If yes**, add
   `"<Section>__<Key>" = <value>` to BOTH API blocks (`:7143+` and `:7570+`) — remember an App Service app
   setting **overrides** `appsettings.json`. **If no**, appsettings alone is sufficient and nothing in
   `azureautomation` changes.
3. Only add to `$script:RequiredApiAppSettings` if absence must fail the deploy.
4. **No ARM change, no `local.settings.json` change, no Key Vault reference** for a non-secret dial —
   the PHASE 4e KV gate is MCP-only.
5. If the key is a model pin or a latency dial, add it to `AiModelPinConventionTests` (`:63-75` or `:97-106`)
   and mirror it in `appsettings.ca.json` / `appsettings.in.json` if region-overridden (`:130-150`).
6. Delete the key everywhere if the code path is later removed (CLAUDE.md §4 — no orphan settings).

---

## E. Reusable for Provider AI Search

1. **Knowledge-document VIEW link (cost-free, FD-routed) — copy `VoiceAssistantController`.**
   `TransformToPublicUrl(BuildStorageUrl(Containers.ProviderKnowledge, row.BlobPath))` gives an FD URL +
   **30-min** read SAS (`ReadSasExpiryMinutes`), HTTPS-only, **no `rscd`** ⇒ the browser renders inline, and it
   costs **zero storage round trips** (`AzureStorageService.cs:929-960, 998-1036, 1038-1049`). Guard the result
   with a `RequireSignedRecordingUrl`-shaped check (`VoiceAssistantController.cs:742-750`) because a
   transformed URL with an empty query on a private container is a guaranteed-dead link. For a forced download,
   `TransformToDownloadUrl(url, row.DocName)` (`:965-996`) sets
   `attachment; filename="…"; filename*=UTF-8''…`. If the stored `Content-Type` cannot be trusted (it is
   client-controlled at PUT, F.2 below), pass `contentType` so the SAS `rsct` fixes it (`:1013`).
   Ownership is already guaranteed by a partition-scoped point read (`KnowledgeController.cs:542-546`) plus
   `KnowledgeBlobPaths.IsDirectSourceBlob` (`KnowledgeBlobPaths.cs:18-29`).
   PDF page anchors: append `#page={PageNumber}` client-side (browser PDF viewers honour it; it is not a
   storage feature).
2. **Inline PICTURES.** Reuse the exact shape of `GET documents/{docId}/images`
   (`KnowledgeController.cs:855-900`; DTO `KnowledgeDtos.cs:98-120`): `ThumbnailUrl` (from `ThumbPath`,
   WebP 320 px) for the strip, `Url` for the viewer; filter `Status != Deleted` via `LiveImages`
   (`:848-849`); bound the fan-out (`ImageSasConcurrency = 8`, `:45, :865`). Cheaper variant: mint with the
   local signer of item 1 instead of `GetUrlForReadAsync`, which costs one storage call per URL.
   Client helpers already exist: web `getThumbSrc`/`getOriginalSrc`/`getViewerChain`
   (`src\utils\mediaDerivative.js:43, 47, 51`) with the lightbox at
   `KnowledgeImagesPanel.jsx:258`.
3. **Knowledge CITATIONS.** The knowledge index already carries `docId`, `docName`, `docTitle`,
   `sectionTitle`, `pageNumber`, `chunkKind`, `docType`, `linkedGroupName`, `linkedServiceIds/Names`,
   `imageRef` (`KnowledgeSearchDocument.cs:26-116`). The retrieval select
   (`ProviderKnowledgeSearchService.cs:52-56`) has everything **except `pageNumber`** — add it there (a
   retrievable-only `SimpleField`, so no index change is needed, only a select-list change) or read it via
   `RefSelectFields` (`:64-65`). Copy the scoping template wholesale: `businessId` always selected,
   `AssertScoped`, per-hit re-check, `RaiseCrossTenantLeak` + discard (`:131-132, 291-308, 672-702`).
4. **Service CITATIONS + breadcrumb.** The service index returns `serviceId`, `serviceName`, `categoryId`,
   `categoryName`, `subcategoryId`, `subcategoryName`, the price tier fields, `serviceImages.thumb/medium`,
   `isActive`, `isListed`, `businessStatus`, `businessId` — so `categoryName > subcategoryName > serviceName`
   needs **no extra lookup**. `Category.FullPath` (`Cosmos.cs:368-369`) or the 24-h cached global list
   (`CategoryRepository.cs:75-105`) covers Cosmos-sourced cards; `GetCategoryByIdAsync` is two partition-scoped
   point reads (`:150-185`). Scope with `businessId eq '{id}'` + `AssertScoped` + post-read check exactly as
   `ProviderCatalogSearchService.cs:48-55, 266-293, 331-332, 624`; `voiceCatalogScoring`
   (`cosmosindexsetup\Program.cs:221, 432`) is the provider-scoped profile that avoids marketplace boosts.
   **`approvalStatus` needs the Cosmos row** (`Cosmos.cs:459-462`) — it is not indexed.
   **Every new `SearchAsync<ServiceSearchDocument>` MUST populate `Select`** or
   `SearchProjectionConventionTests` (`:49-97`) fails the build; any `$orderby` field must be `IsSortable`
   (`SearchOrderByIsSortableConventionTests:31-42`).
5. **Edit deep links.** Web: `/dashboard/profile/manage-services-price?serviceId={id}[&businessId={id}]`
   (`routeConfig.jsx:91`; builder `notificationNavigation.js:15-20`; consumer
   `ManageServicesPrice\index.jsx:201-244`, which switches workspace and strips the query).
   Mobile: `navigation.navigate('AddService', { serviceId, businessId?, entryContext: 'profile' })`
   (`constant.tsx:22`; builder `Util\notificationNavigation.ts:36-46`; consumer
   `AddService\index.tsx:126-161, 939-944, 1100-1121`). Knowledge page: web
   `/dashboard/profile/knowledge` (`routeConfig.jsx:86`), mobile `Knowledge` (`constant.tsx:140`,
   `linking.ts:104`).
6. **Clients.** Inject the existing `SearchClient` (service index) and `KnowledgeSearchClient` singletons
   (`Clinqet.API\Program.cs:954-999`). If the feature must survive an unprovisioned stamp, follow the MCP
   null-client degrade (`Clinqet.Mcp\Program.cs:240-288`) — note `deploy.ps1:6820` writes a BLANK
   `AISearch__Endpoint` on such a stamp, and the API registrations `?? throw` on a missing key.
7. **Localization.** Every new string ⇒ 15 files: `en/es/fr/gu/hi.json` (API, `LocalizationResourceTests`
   `:77-91` + `LocalizationSourceConventionTests` `:25-53`), all five `public\lang\*.json` (web,
   `localeParity.test.js:3-9` includes `es-US` even though `IntlContext.jsx:7-19` does not serve it), all five
   `src\Locales\*.json` (mobile, `localeParity.test.ts:7, 38-70` — **no inline ICU plural/select, double-brace
   interpolation only**). No email template is needed.
8. **Model choice.** Add a per-flow `<Flow>DeploymentName` seam (D.3 step 3) rather than reading
   `AIService:DeploymentName`; the host default is pinned to `gpt-5.4-mini` for tool calling
   (`AiModels.cs:9-11`; `AiModelPinConventionTests.cs:15-18, 55-60`). A new `AiSubFlows` id
   (`AiSubFlows.cs:7-40`) makes the spend attributable. Mini and luna already have pricing rows, so no
   `TokenPricing` change is needed unless a NEW model is introduced.
9. **SSE.** `AIAssistantController.cs:1256-1273` is the working SSE writer:
   `Response.ContentType = "text/event-stream"`, `Cache-Control: no-cache`, `Connection: keep-alive`,
   `HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering()`, then
   `WriteAsync($"data: {json}\n\n")` + `Response.Body.FlushAsync()`.

---

## F. Gaps · risks · contradictions

### F.1 ‼️ Contradicts PLAN.md §4.5 / §10

| # | PLAN says | Verified truth | Severity |
|---|---|---|---|
| 1 | §4.5 service card `route: /dashboard/services?serviceId= (web)` | **There is no `/dashboard/services` route.** `src\app\dashboard\` has no `services` folder and `routeConfig.jsx` has one services key: `ManageServicesPrice: "/dashboard/profile/manage-services-price"` (:91). The correct link is `/dashboard/profile/manage-services-price?serviceId={id}[&businessId={id}]` (`notificationNavigation.js:15-20`) | **must fix** — the plan's own parenthetical already names `ProfileRoute.ManageServicesPrice`, so the literal is a typo, but it is the literal a reader will implement |
| 2 | §4.5 mobile `AddService {serviceId, businessId, entryContext:'profile'}` | **CORRECT and already implemented** (`AddService\index.tsx:126-161, 1100-1121`; builder `Util\notificationNavigation.ts:36-46`). **This finding file's earlier gap "mobile deep link cannot open a specific service" was WRONG** — it measured `ManageService`, the list screen | plan is right; retract the old gap |
| 3 | §4.5 service card carries `approvalStatus` | **Not in the search index.** `ServiceSearchDocument` has `isActive` / `isListed` / `businessStatus` only; `Service.ApprovalStatus` lives in Cosmos (`Cosmos.cs:459-462`) ⇒ **one extra partition-scoped point read per cited service**, which §4.6's cost line ("1–2 Cosmos partition reads") must actually cover for N cards | **cost/design** |
| 4 | §4.5 `page?` shown for paginated sources | The knowledge retrieval **`SelectFields` does not include `pageNumber`** (`ProviderKnowledgeSearchService.cs:52-56`); only `RefSelectFields` (:64-65) does. Fix by adding it to the retrieval select (safe — `pageNumber` is a retrievable-only `SimpleField`, `KnowledgeSearchDocument.cs:92-94`) or by a second by-id read | **must fix** |
| 5 | §4.5 paginated extension list includes `heif` | **`.heic`/`.heif` are refused at upload** (`StorageConfiguration.cs:61-71`, comment "H8: .heif/.heic are deliberately absent") ⇒ no such `docName` can exist. `heif` in that list is dead code | minor |
| 6 | §4.5 pictures use a `Parallel.ForEachAsync` cap of 4 | The existing images endpoint caps at **8** (`ImageSasConcurrency`, `KnowledgeController.cs:45, 865`). 4 is fine (and cheaper) but is a deliberate divergence from the shipped constant, so state it rather than let a reviewer read it as a mistake | note |
| 7 | §4.5 "Open document → lazy `view-url` on click" implies a new primitive | The primitive exists and is already used **in a controller** for a private container: `TransformToPublicUrl` (inline) + `TransformToDownloadUrl` (attachment) + `RequireSignedRecordingUrl` (`VoiceAssistantController.cs:700-750`), FD-routed, 30-min, **zero storage round trips**. No new `IAzureStorageService` member is needed (retracting the earlier draft's "interface change touching four hosts' mocks") | **plan can be simpler** |
| 8 | §10 "appsettings only (**per-flow keys are not env vars**)" | **FALSE as a description of the current pattern.** Every per-flow `*DeploymentName` the API uses is written by `deploy.ps1` as a `__` app setting — `Search__SpellCheck__Llm__DeploymentName`, `SearchIndexEnrichment__DeploymentName`, `AzureDocumentIntelligence__Ai/VisionAiDeploymentName`, `BroadcastClassification__Ai/VisionDeploymentName` at **:7175-7180** and **:7597-7602**. An App Service app setting **overrides** `appsettings.json`. Leaving `ProviderSearch:Answer:DeploymentName` out of `deploy.ps1` is a valid choice **only if it must never be tuned per stamp**; the plan should say which | **must decide** |
| 9 | §10 "no new Azure resource, queue, container or ARM change; no `local.settings.json` key" | **TRUE, verified.** A model deployment is a REST child of the existing Foundry account (`:2825-2826`); no queue/container/ARM edit is implied; the PHASE 4e Key Vault gate is MCP-only (`:8085-8364`); the Foundry/Search keys are already plain app settings | confirmed |
| 10 | §10 "Localization ×15 files" | **CORRECT** (5 API + 5 web + 5 mobile). Add: web ships 5 files but serves 4 (`es-US` authored, not loaded — `IntlContext.jsx:7-19`); mobile ships 5, registers 4 (`i18n.ts:11-16`). Both parity suites still REQUIRE the `es` keys | confirmed |
| 11 | §10 "pins in `AiModelPinConventionTests`" | Concretely: a Luna pin goes in `LunaPins` (`:63-75`) **and** the regional theory (`:130-150`) reads `appsettings.ca.json` / `appsettings.in.json`, so both regional files need the key too — or the region test fails | detail |
| 12 | §10 `AiSubFlows.ProviderSearchAnswer` | `AiSubFlows.cs:7-40` uses a **lettered** scheme `A1…H3`; a new flow needs a new letter (e.g. `I1-provider-search-answer`). No convention test pins the list, so nothing fails the build — but the per-call usage log attributes to `"unattributed"` (:39) if the id is not threaded through | detail |
| 13 | §4.8 model probe / §13 luna risk | Consistent with the tree: `AiModels.cs:9-10` states gpt-5.6 cannot do tool calls on Chat Completions and the host default is A3's only defence; the RAI filter applies only to names in `$modelDeployments` (`:2825, 2945`; `AiModels.cs:5-6`), and luna IS in the array so `ClinketContentFilter` is attached to it | confirmed |

### F.2 Other gaps and risks

1. **Stored `Content-Type` of an original is client-controlled.** The upload SAS sets only the SAS response
   override for that SAS (`rsct`, `AzureStorageService.cs:1614`); the blob's own content type comes from the
   client's `x-ms-blob-content-type` at PUT (not verified in the web/mobile upload code — out of this brief).
   Mitigation: pass `contentType` into the read SAS (`rsct`, `:1013`) derived from `DocName`'s extension so
   inline rendering never depends on the stored header.
2. **Page-level open works only for PDFs** (`#page=`). `.docx/.xlsx/.pptx/.txt/.md/.json/.html` have no
   in-browser page viewer, so a citation can open the file but not the page. Open question for the owner:
   convert to PDF at ingest (a new blob = new cost + a new lifecycle rule) or show the page number without
   navigation.
3. **`GetUrlForReadAsync` bypasses Front Door** (raw `*.blob.core.windows.net`, `:852-874`) — the images
   endpoint, the draft images and the WhatsApp pictures all do this today; `BlobUrlValidator` accepts both
   hosts (`:41-50`). A FD-routed signer keeps the WAF in path and hides the account host, and is what
   `VoiceAssistantController.cs:698-699` explicitly demands for private media.
4. **TTL choice.** 30 min (`ReadSasExpiryMinutes`) vs 60 min (`InternalSasExpiryMinutes`) vs 720 min (WhatsApp
   documents). An answer that stays on screen longer than the TTL needs re-minting on click (a "resolve link"
   call, which is exactly the `view-url`-on-click design) or a longer dial — a new setting must follow §0.12
   (class default = appsettings default).
5. **Streaming through Front Door.** `networking.json:11-18` states AFD does not support SSE streaming and
   bounds the WHOLE origin response at ≤240 s; the API is fronted by AFD at `api-<slug>.<apex>`
   (`deploy.ps1:1137-1153`, `:4255`, origin group `networking.json:810`, origin `:923`) and the partner web
   calls exactly that host (`clinqetwebpartnerapp\.env:17` = `https://api-ca.dev.clinket.com/api/v1/`,
   consumed at `src\api\url.js:15` as `OWNER_URL`). The existing `/ai/chat` SSE
   (`AIAssistantController.cs:1256-1273`) already lives with this, so the risk is "known and survivable", not
   "new" — but **a > 240 s answer is severed**, which bounds `MaxCompletionTokens` × `MaxToolIterations`.
6. **`imageRef` comment/code drift.** `ProviderKnowledgeSearchService.cs:58-60` describes a kill switch that
   gated the `imageRef` select; the code now adds it **unconditionally** (`:143`, `:431`). The comment's real
   warning still applies to any NEW field: *"selecting a field an index does not declare is a query-time 400
   on EVERY search"* — so a new select field must ship after the per-region `cosmosindexsetup` run, not before.
7. **Category names are not localized** (C.3) — breadcrumbs render the authored (English) name in every UI
   language. `VoiceAssistant:SupportedLanguages` additionally includes `pa` (`appsettings.json:171`), a
   language with no catalogue file at all.
8. **Search SKU headroom.** `basic`, 1 replica / 1 partition (`ai.json:96-97`) — no read-availability headroom
   for an interactive feature adding per-answer queries. Not a code finding; a capacity consideration.
9. **Dead code:** `StorageManagerService.GenerateSecureDownloadUrlAsync` (`:528`, a 24-hour SHARED-KEY SAS
   that would throw under delegation mode) has **no callers** — do not reuse; §22.2 removal candidate for
   whatever change next touches the file.
10. **`ManageServicesPrice.jsx.backup` is tracked in git** (`clinqetwebpartnerapp`, confirmed via
    `git ls-files`) beside the live `ManageServicesPrice\index.jsx` — pre-existing dead weight, worth flagging
    under §0.16/§22.2 but NOT this programme's to delete.
11. **`ai-foundry.json:5` metadata is stale** — it says "ONE AI Foundry account per environment-tier, pinned to
    East US 2", but the same template is now deployed a second time to Sweden Central for India voice
    (`deploy.ps1:3016-3023`). Documentation-only; the template itself parameterises the location correctly.
12. **Committed key material.** `Clinqet.API\appsettings.json:2019` (`AIService:ApiKey`),
    `:1982`-area (`AzureAIFoundry:ApiKey`), `appsettings.ca.json:19, 25`, `appsettings.in.json:22, 28` and
    `appsettings.json:2039-2041` (`Mcp__*`) carry live-looking Foundry / Search / MCP secrets in tracked
    files. Outside this brief (CLAUDE.md §19); flagged for the owner.
13. **SAS IP restriction absent** (A.1) and `allowBlobPublicAccess: true` at the account level
    (`storage.json:65`) — the `provider-knowledge` container itself is private (`:688`), so a view link is
    bearer-style for its TTL: anyone holding it can read that one blob until it expires.
14. **`MemoryCache:SizeLimit = 50000`** (`appsettings.json:2-4`) ⇒ any cache the feature adds MUST set
    `Size = 1` or it is a runtime 500 (CLAUDE.md §14; `MemoryCacheSizeConventionTests` fails the build).
16. **Rate-limit shape.** `AIAssistant:RateLimiting` (`appsettings.json:2200-2222`) already holds three named
    sub-sections (`TextEnhancement`, `McpChat`, `DocumentIntelligence`), each
    `{Enabled, RequestsPerWindow, WindowMinutes, TokensPerWindow[, RequestsPerDay]}`, under
    `Enabled` + `EnableTokenBasedLimiting` (:2201-2202). PLAN §4.6's `…:ProviderSearch:{RequestsPerWindow 10,
    TokensPerWindow 100k}` fits that shape exactly — whether `AiRateLimitingService` binds a fourth named
    section without code change is C's territory, NOT VERIFIED here.

---

## G. ‼️ Provenance and concurrency warning (read before trusting a line number)

**Every citation in this file was verified against the HEADs named in the banner, and re-confirmed against
`git show HEAD:<path>` for every file that later went dirty.** The one exception is retracted at §0 row 7b.

**A concurrent AI session started editing these repos DURING this pass** (they were clean at
`git status --porcelain` at the start and dirty at the end). At the moment of writing, these files carry
UNCOMMITTED changes by that other session — **`git checkout` / `restore` / `reset` / `stash` on any of them
would destroy that work (CLAUDE.md §0.19); nothing here was reverted, and nothing should be:**

| Repo | Uncommitted files (another session's work) |
|---|---|
| `clinqetcore` | `Interfaces/AI/IDocumentPageRasterizer.cs` · `Interfaces/AI/IVisionDocumentTranscriptionService.cs` · **`Models/Knowledge/KnowledgeBlobPaths.cs`** |
| `clinqetshared` | `DTOs/Knowledge/KnowledgeDtos.cs` · `Models/AIAssistantSettings.cs` · `Models/AIServiceSettings.cs` · `Models/VisionTranscriptionSettings.cs` · `Models/VoiceKnowledgeSettings.cs` |
| `clinqetinfrastructure` | `Resources/Localization/{en,es,fr,gu,hi}.json` · `Services/AI/AICompletionService.cs` · `Services/AI/DocumentPageRasterizer.cs` · `Services/AI/ProviderSetupDocumentReader.cs` · `Services/AI/VisionDocumentTranscriptionService.cs` |
| `clinqetapi` | `Clinqet.API/Controllers/Knowledge/KnowledgeController.cs` · `Clinqet.API/appsettings.json` · `Clinqet.API.UnitTests/Conventions/VoiceKnowledgeSettingsConventionTests.cs` · `Clinqet.API.UnitTests/Services/AICompletionServiceTests.cs` |
| `clinqetmcp` | `Clinqet.Mcp/appsettings.json` |
| `clinqetfuncations` | `Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs` · `Clinqet.Communications/Services/KnowledgeServiceDraftAnalyticsJob.cs` · `Clinqet.Communications/appsettings.json` · four knowledge/vision test files |
| `clinqetwebpartnerapp` | `src/components/Profile/knowledge/KnowledgePage.jsx` · `src/components/Profile/knowledge/UploadKnowledgeModal.jsx` |
| `clinqetmobilepartnerapp` · `azureautomation` · `cosmosindexsetup` | clean |

**Anchors re-confirmed identical at HEAD after the edits landed** (so the tables above are safe):
`KnowledgeController.cs` :45, :73, :135, :522, :855, :902 · `Clinqet.API/appsettings.json` :2, :171, :654,
:736, :2002, :2017, :2030, :2321, :2648, :2996 · `KnowledgeDtos.cs` :98, :118, :120 ·
`AIServiceSettings.cs` :24, :29, :31, :39 · `AICompletionService.cs` :352, :363 ·
`KnowledgeIngestProcessorFunction.cs` :1079 · `KnowledgeServiceDraftAnalyticsJob.cs` :304 ·
Functions `appsettings.json` :385, :552 · MCP `appsettings.json` :136 ·
`KnowledgeBlobPaths.cs` :5-119 (163 lines at HEAD).

**Key-count provenance:** API `en.json` = **3,121** at HEAD (`git show HEAD:` recount); the working tree
already reads **3,122** because the other session added one key mid-pass. Partner web (5,929) and partner
mobile (5,619) are HEAD figures — neither repo's locale files are dirty.

**What is visibly in flight** (relevant to Provider AI Search, not this brief's to design): a document
rasterizer + vision-transcription reshuffle (`IDocumentPageRasterizer`, `IVisionDocumentTranscriptionService`,
`VisionTranscriptionSettings`, `VoiceKnowledgeSettings`), a knowledge upload/limits surface
(`KnowledgeController.ListKnowledge` gains `MaxFileSizeBytes` / `MaxPagesPerDocument` /
`MaxExtractedCharacters` in its response DTO), and an OCR cache key that will include the deployment name.
**Re-grep every knowledge/AI anchor in §A and §D before implementing.**
