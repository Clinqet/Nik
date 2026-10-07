---
name: clinqet-service-listing
description: |
  **CORE FEATURE SKILL** — Work on the Service Listing feature end-to-end.
  Provider's service catalog: Service entity CRUD, multi-tier pricing (fixed /
  starting-from / hourly with discount + tax), service images via media-derivatives
  pipeline, category/subcategory selection from cached hierarchy, service-area
  assignment, AI enrichment (via Cosmos change feed → SearchIndexSyncFunction),
  admin approval workflow with notification types, soft-delete with TTL, partner
  catalog UI, admin moderation page.
  USE FOR: Service CRUD, pricing model design, image upload + derivatives,
  category/subcategory linkage, service area assignment, approval state
  machine (PendingApproval → PendingAIValidation → Approved | Rejected |
  AIRejected | PendingProviderCompletion), AI enrichment trigger, search index
  sync (cross-feed), admin approval page, partner-app manage-services UI.
  Applies to clinqetcore/Entities/COSMOS/Cosmos.cs (Service + ServiceImage +
  Pricing + ServiceDuration), clinqetinfrastructure/Data/COSMOS/
  ServiceRepository.cs, clinqetshared/Enums/ServiceApprovalStatus.cs,
  clinqetshared/DTOs/COSMOS/Cosmos.cs (ServiceDto + PricingDto +
  ServiceDurationDto), clinqetapi Controllers/ServiceController.cs,
  clinqetfunctions Functions/SearchIndexSyncFunction.cs (AI enrichment + approval),
  clinqetwebadmin src/pages/services/ServiceApprovalPage.jsx, clinqetwebpartnerapp
  src/app/dashboard/profile/manage-services-price/page.jsx.
---

# CLINQET SERVICE LISTING — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (a service with no price goes live as "Price on request")

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **`PriceTypes.OnRequest` (`"On request"`)** is the fourth price type. Every amount is null, the service is NOT bookable online, and customers see "Price on request" with "Ask for price" and Call.
- ‼️ **ONE rule for "has a price": `ServiceBookingPrice.HasSetPrice`.** A minimum charge alone IS a price ("From $120"). `ProviderScoreCalculator.HasPrice` now asks that rule and ALSO counts an on-request service as having answered — those services used to be parked (in neither half of the completeness fraction) and going live would otherwise have DEMOTED the providers this change exists to list.
- ‼️ **A missing price no longer PARKS a service.** `ProviderSetupServiceWriter` parks only on a missing category; parking starved search and left the provider with nothing to show.
- ‼️ **0 is refused**, everywhere: the API endpoints, bulk upload, the MCP service tools, and all four forms. A service stored at 0 reads to a customer as free and books at nothing.
- ‼️ **`ServicePricingRules.Normalize` nulls every PRICE (including the minimum charge) but KEEPS the provider's typed visit fee, travel rate and discount, switched OFF.** Every reader is gated on the switch AND on on-request, and deleting them meant picking a price again did not bring them back.
- ‼️ **The wire token is `"onrequest"`** (or `"on request"`/`"on_request"`/`"on-request"`). `NormalizePriceType` falls back to **fixed** for anything else — including a missing value — which stores a price-less service as a priced one with no amounts.
- **An update that states NEITHER a type NOR an amount is not judged**: the mapper falls back to the stored price, so there is nothing new to validate.
- **The zero check is currency-aware** — the service's own currency, not the default minor unit.

## SERVICE NAME→ID RESOLUTION CACHE — INVALIDATION CONTRACT (2026-08-25)

`IServiceNameResolver` (`clinqetinfrastructure\Services\Catalog\ServiceNameResolver.cs`, API + MCP
hosts) caches a per-business (normalized name → serviceId) map so "Other" booking/quote lines can
attach the real serviceId without querying the catalog per request. Repository support:
`IServiceRepository.GetActiveServiceNameEntriesAsync` — slim `SELECT c.serviceId, c.name`
projection, partition-scoped, filters `isDeleted=false AND isActive=true` (existing included
paths; no new index).

‼️ **CONTRACT: any code path that changes a Service's NAME, IsActive or IsDeleted in the API or
MCP host MUST call `IServiceNameResolver.Invalidate(businessId)` after the write.** Current
callers: ServiceController (create/update/duplicate/delete + both bulk branches),
CategoryController (both `DeleteServicesBySubcategoryAsync` cascades), `ProviderSetupServiceWriter`
(create + update), MCP `ServiceManagementTools` (create_services/update_service/delete_service).
Deliberately NOT calling it: admin approve/reject (approval is not in the map), image-confirm
updates, currency restamps (`BusinessProfileController`/`ProviderSetupProfileService`),
`KnowledgeDraftApprovalService` approve-update (price/category only). Functions-host writes
(AI validation status) don't affect the map; cross-host staleness is TTL-bounded
(`ServiceNameResolution:CacheTtlMinutes`, default 10) and made SAFE by the resolver's live
point-read name re-verification — a stale map can never attach a wrong or renamed id.

## RECENT CHANGES - 2026-08-14 (AI-upload approval and pricing remediation)

- Complete usable AI-uploaded pricing produces `Approved` immediately. Only incomplete or unusable new pricing produces the existing `PendingProviderCompletion`; no new approval status was introduced. Existing trusted complete pricing is preserved and produces no remediation notification.
- Each committed incomplete service produces one durable `ServicePricingRequired` notification-center row with exact Service context, no push, and no SignalR. The upload also produces exactly one transient `ServicePricingRequiredSummary` per recipient when at least one incomplete service persisted; it is eligible for push/SignalR and is never stored.
- `CatalogActionRequired` routes service rejection and pricing-remediation events as `ServiceCatalog` work to active unique administrators and people with `catalog.service.update`. It never uses NewWorkIntake/lead routing.
- Provider web and mobile reuse their existing exact-service editors. Per-service notifications open the identified service after workspace and permission checks; summaries open Notifications. During onboarding, aggregate taps do not navigate and cannot expose the dashboard shell.
- Missing or ambiguous tax evidence remains a no-op. Do not infer or default per-service tax merely because pricing is otherwise complete.

## RECENT CHANGES — 2026-08-13 (AI provider-setup taxonomy, pricing and tax hardening)

- AI provider setup now searches the complete global category/subcategory hierarchy first and reuses a valid pair when it genuinely fits. It never forces a weak closest match. If the global category fits but no child fits, the resolver keeps that global parent and creates only a deterministic business-scoped custom subcategory. If no parent fits, it creates a deterministic custom parent and child. The AI's confidence value explains the choice but does not act as a hard server gate.
- `ProviderSetupTaxonomyResolver` validates IDs, the parent-child relationship, ownership, bounded proposed names and the `AllowCustomCategoryCreation` switch. AI-owned custom nodes trigger one logical required admin alert through a deterministic event; replay repairs a failed dispatch without creating a duplicate alert. Global reuse and existing provider-owned custom reuse do not alert.
- A setup price is complete only when fixed/hourly is finite and positive, or a range has finite positive start and max values with `max >= start`. New incomplete services are `PendingProviderCompletion`; unusable OCR never replaces trusted pricing on an existing service.
- `Pricing.TaxIncluded` and `Pricing.TaxRate` are evidence-only extraction fields. They are set only when the uploaded document explicitly supplies usable tax information; missing or ambiguous evidence leaves new values unset and preserves existing values. Do not confuse them with nullable `Service.Taxable`, which inherits the provider's business billing default.
- Provider web and provider mobile use the same completeness predicate, including both range bounds, and receive the exact affected service IDs for the existing edit surfaces.

## RECENT CHANGES — 2026-07-29 (services created by a CATALOG MANIFEST import)

A provider-setup run can now be fed a structured *catalog manifest* instead of a flyer (see `clinqet-ai-assistant`). Services it creates differ from AI-extracted ones in four ways that matter here:

- **`ServiceId` is deterministic**, not `Guid.NewGuid()`: `DeterministicGuid.Create(businessId, "service", externalId)` (`clinqetcore\Utilities\DeterministicGuid.cs`, RFC 4122 v5). Re-importing the same chunk point-reads the existing document and takes the update path, so it cannot duplicate. `ServiceId` stays within `ServiceDto`'s 50-char limit.
- **`Description` is genuinely multi-paragraph** — summary, then a labelled attribute line (Make · Model · Year · Stock # · Serial # · Hours · Condition · Branch · Seller · Rebuild), then the feature list. Labels resolve through `ILocalizationService` at import time. `ServiceDto.Description` has no length validation; the manifest path caps each paragraph at `MaxDescriptionParagraphLength`.
- **`Pricing.Currency` is set explicitly.** It defaults to `"USD"` on the entity, so an import that did not stamp it would silently mis-label Canadian prices. `Pricing.Notes` carries the localized deposit line. `CreatePricingFromExtracted` now honours `svc.Currency` and `svc.PriceNote`.
- **`Taxable` / `AcceptsOnlinePayments` still stay NULL** so imported services follow the business defaults — unchanged, and covered by the integration test.

‼️ **`Storage:ServiceImages:MaxFileCount` IS enforced** — `ServiceController.ConfirmServiceImageUpload` rejects an upload past the cap and, when the cap is 1, **deletes the existing image** before adding the new one. It is 1 today, so a service holds one hero image. The customer-facing service page (`clinqetwebuserapp\components\customer\providerService\ProviderServiceContent.jsx`) can already *render* hero + 4 tiles + "+N more" (`PHOTO_TILES = 4`), and a partner service edit posts the whole array back, so raising the cap is a config change — but until it is raised, one image is what the platform allows. The manifest importer caps itself at `min(MaxImagesPerRecord, MaxFileCount)` so it can never exceed what the platform permits.

**Imported taxonomy uses the shared global-first resolver.** A genuine global category/subcategory pair is reused. When only the global parent fits, only a business-scoped custom child is created; when no global parent fits, a business-scoped custom parent and child are created. Custom identities are deterministic and remain isolated to the provider; `AzureSearchIndexer` and the voice catalog map resolve them through `GetCategoryByIdAsync(id, businessId)`.

**A no-price record still becomes `PendingProviderCompletion`** — the existing behaviour, unchanged.


## ENTITY (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `Service` (~lines 251-314)
- Container: `ProviderData`. Partition key: `/businessId`. Document id: `{businessId}_{serviceId}`. ETag concurrency.
- Fields:
  - `serviceId`, `businessId` (pk)
  - `categoryId`, `subcategoryId` — references to Category entities (same container)
  - `name: string`, `description: List<string>` (multi-paragraph)
  - `serviceImages: List<ServiceImage>`
  - `pricing: Pricing`
  - `serviceAreaIds: List<string>` — empty = global; otherwise specific ServiceArea ids
  - `isActive: bool` (default true)
  - `displayOrder: int` (default 0)
  - `duration?: ServiceDuration`
  - `isAtStore: bool` (default false), `isAtCustomersLocation: bool` (default false)
  - `isDeleted: bool` (default false) — soft-delete flag
  - `approvalStatus: ServiceApprovalStatus?` (default `PendingApproval`); serialized via both Newtonsoft `StringEnumConverter` AND `System.Text.Json.JsonStringEnumConverter`
  - `approvalRejectionReason?: string`, `approvedAt?: DateTime`, `approvedBy?: string`
  - `ttl: int?` — set to `CosmosDb:ServiceDeleteTtlDays` (default 30) on soft-delete

### `ServiceImage` (embedded)
- `imageId, url, fileName, fileSize, contentType, isVideo`
- `thumbnailUrl?, mediumUrl?, width?, height?`
- `processingStatus` (Pending → Ready → Failed | Skipped), `processedAt?`

### `Pricing` (~lines 327-400)
- `priceType: string` — `"Fixed"`, `"Starting from"`, `"Hourly"`
- `fixedPrice?, startPrice?, maxPrice?, hourlyRate?, minimumHours?`
- `minimumCharge?, chargePerVisit?, chargePerDistance?, minDistance?, distanceUnit?`
- `taxIncluded: bool, taxRate?`
- `discountEnabled: bool, discountType?, discountValue?, discountConditions?`
- `currency: string` (default `"USD"`)
- `notes?`

### `ServiceDuration` (~lines 316-325)
- `unit: DurationUnit` (Minutes/Hours/Days)
- `value: decimal` (e.g. 1.5)

---

## ENUMS

### `ServiceApprovalStatus` (`clinqetshared\Enums\ServiceApprovalStatus.cs`)
Verbatim: `PendingApproval, PendingAIValidation, Approved, Rejected, AIRejected, PendingProviderCompletion`. `[JsonConverter(typeof(JsonStringEnumConverter))]`.

### `DurationUnit` — `Minutes, Hours, Days`.

### Service-related `NotificationType`
`ServiceApprovedByAdmin, ServiceRejectedByAdmin, ServiceApprovedByAI, ServiceRejectedByAI, ServiceCategoryAutoCorrected`.

### Service-related `AdminAlertType`
`ServiceAwaitingApproval, ServiceRejectedByAI, ServiceApprovedByAI, ServiceCategoryAutoCorrected, ServiceCategoryMismatchDetected, ServiceMissingCategoryReference`.

---

## CONTAINER & INDEXES

### ProviderData partition key `/businessId`. Service-relevant included paths:
`/type/?`, `/categoryId/?`, `/subcategoryId/?`, `/isActive/?`, `/isDeleted/?`, `/pricing/startPrice/?`, `/pricing/priceType/?`, `/serviceImages/[]/imageId/?`, `/displayOrder/?`.

Composite indexes (relevant subset):
- `(/displayOrder ASC, /name ASC)` — category catalog sort
- `(/type ASC, /parentCategoryId ASC, /isActive ASC, /approved ASC)` — category traversal
- `(/type ASC, /createdAt DESC)` — chronological list

Filter columns lead `ORDER BY` (memory `feedback_cosmos_emulator_vs_prod_matcher`).

---

## DTOs

### `ServiceDto` (`clinqetshared\DTOs\COSMOS\Cosmos.cs` ~lines 68-118)
```csharp
public record ServiceDto(
    string? ServiceId,
    [Required] string Name,
    [Required] string CategoryId,
    [Required] string? SubcategoryId,
    List<string>? Description,
    List<ServiceImage>? ServiceImages,
    List<string>? RemoveServiceImages,   // imageIds to drop on update
    PricingDto? Pricing,
    List<string>? ServiceAreaIds,
    bool? IsActive,
    int? DisplayOrder,
    ServiceDurationDto? Duration,
    bool? IsAtStore,
    bool? IsAtCustomersLocation,
    bool? AcceptsOnlinePayments = null,   // tri-state: null ⇒ inherit business
    bool? Taxable = null);                // tri-state: null ⇒ inherit business
```

`AcceptsOnlinePayments` and `Taxable` are **tri-state** (`true` / `false` / `null` = follow the business default). See **TRI-STATE FULL-REPLACE** below — the update semantics are a hard client contract.

### `PricingDto` (~lines 131-216), `ServiceDurationDto` (~lines 120-129) mirror the entity records with validation attributes that use localization keys.

### `ServiceSummaryDto` (embedded in `SubcategoryWithServicesDto` → `SelectedCategoryWithServicesResponseDto`; both `CategoryController` categories/services endpoints)
- Carries `ApprovalStatus` (`ServiceApprovalStatus?`) + `ApprovalRejectionReason` (`string?`) — **provider-scope only**: populated exclusively by the authorized `GET categories/selections/services`; the public `GET /public/business/{businessId}/categories/services` leaves them null and `[JsonIgnore(WhenWritingNull)]` omits them from the public payload. NEVER populate them on a public surface.
- Provider raw-entity endpoints (`GET /business/services`, `GET /business/services/{serviceId}`) expose approval fields directly via the `Service` entity.

---

## REPOSITORY — `ServiceRepository.cs`

All methods partition-scoped on `/businessId`.

- `GetByBusinessIdAsync(businessId, ct)` — all non-deleted services.
- `GetByCategoryAsync(businessId, categoryId, ct)`.
- `GetBySubcategoryAsync(businessId, subcategoryId, ct)`.
- `GetCountBySubcategoryAsync(businessId, subcategoryId, ct) → int` — for category counters.
- `CreateServiceAsync(service, ct)` — composite id assignment.
- `UpdateServiceAsync(service, ct)` — ETag concurrency.
- `GetServiceByIdAsync(serviceId, businessId, ct) → Service?` — returns null if `IsDeleted=true`.
- `DeleteServiceAsync(serviceId, businessId, ct)` — **soft-delete**: sets `IsDeleted=true`, `TTL = CosmosDb:ServiceDeleteTtlDays * 86400` (default 30 days grace).
- `DeleteServicesBySubcategoryAsync(businessId, subcategoryId, ct)` — cascading soft-delete.
- `GetServicesByPriceRangeAsync(businessId, minPrice, maxPrice, ct)`.
- `GetServicesByPricingTypeAsync(businessId, priceType, ct)`.
- `ServiceNameExistsAsync(businessId, serviceName, excludeServiceId?, ct) → bool` — duplicate-name guard.
- `GetServiceCountsByBusinessAsync(businessId, ct) → Dictionary<string, int>` — counts grouped by subcategory.
- `UpdateServiceImageDerivativesByIdAsync(businessId, serviceCompositeId, imageId, MediaDerivativeUpdate, ct)` — patches array index conditionally on imageId match (cross-link `clinqet-media-derivatives` skill).

---

## CONTROLLER — `ServiceController.cs` (`clinqetapi\Clinqet.API\Controllers\`)

Route base `api/v{version:apiVersion}/business/services`. `[Authorize]` on provider endpoints; some `[AllowAnonymous]` on public reads.

| Verb | Route | DTO | Notes |
|------|-------|-----|-------|
| GET | `/` | (query: categoryId?, subCatId?) | Provider's services |
| GET | `/{serviceId}` | — | Single service |
| POST | `/` | `ServiceDto` | Creates service. Validates: category+subcategory exist + belong to business, name unique within business, at least one of `IsAtStore`/`IsAtCustomersLocation` is true. Triggers approval flow + onboarding progress update. |
| PUT | `/{serviceId}` | `ServiceDto` | ETag concurrency; `RemoveServiceImages` lists imageIds to drop. |
| DELETE | `/{serviceId}` | — | Soft-delete. |

Public endpoints (provider's public Open Page consumption) live on `BusinessProfileController` / dedicated public routes — see `clinqet-provider-public-page` skill.

---

## TRI-STATE FULL-REPLACE — `Taxable` + `AcceptsOnlinePayments`

`ServiceMappingExtensions.UpdateFromDto` (`clinqetinfrastructure\Data\COSMOS\Extension\ServiceMappingExtensions.cs`) assigns **both** fields **unconditionally**:

```csharp
service.AcceptsOnlinePayments = dto.AcceptsOnlinePayments;
service.Taxable = dto.Taxable;
```

No `HasValue` guard, no billing-flag guard. This is deliberate: the tri-state (`null` = follow business) is only expressible if an omitted value *clears* the override — a `HasValue` guard would strand a service on an old override it can never leave. The previous behavior was asymmetric and wrong in both directions at once: `Taxable` was wiped by an omitted field, while `AcceptsOnlinePayments` could never be reset to inherit.

> ‼️ **CLIENT CONTRACT — every client MUST always send BOTH fields, including `null`, on every service update, regardless of the billing feature flag.** Omitting one now clears the provider's override. This applies even when the billing UI is hidden, so the form must still load and echo both values.

Note the contrast with the immediately preceding lines in the same method: `IsAtStore` / `IsAtCustomersLocation` **keep** their `HasValue` guards. The unconditional treatment is localized to the two tri-state fields — do not "harmonize" them.

Both clients were updated and send the pair at the top level of the payload builder (never inside a conditional):
- Web: `clinqetwebpartnerapp\src\components\onboarding\add-business-information\ManageServicesPrice\utils\formUtils.js` — `payload.AcceptsOnlinePayments = serviceForm?.acceptsOnlinePayments ?? null; payload.Taxable = serviceForm?.taxable ?? null;` (form defaults `null` in `ManageServicesPrice\constants\index.js`; both load paths use `?? null`).
- Mobile: `clinqetmobilepartnerapp\src\Screen\completeProfileFlow\AddService\index.tsx` — `payload.AcceptsOnlinePayments = acceptsOnlinePayments; payload.Taxable = taxable;` (state is `useState<boolean | null>(null)`; load paths preserve `null` via `typeof === "boolean"` checks).

The create path and the clone path in the same file pass both through unchanged. Services created by the AI Quick Profile Setup run leave both **NULL** on purpose so they follow the business defaults the dialog just set (see `clinqet-ai-assistant`).

### Provider UI simplification (2026-07-22)

Provider web and mobile intentionally expose the same two choices for both rules: **Follow business setting** (`null`) or **No online payment / No tax** (`false`). The redundant explicit-`true` choice is hidden. When an old service contains `true`, clients normalize it to `null` on load and the next save makes it follow the business again.

Both payload builders always send `false` or `null` for BOTH fields, including while the billing UI is hidden. AI-created services also remain `null`. Changing a business default does not rewrite every Service document; `null` is resolved against the current business setting, while a saved `false` remains off.

During onboarding, service payment/tax controls and links to profile settings are not rendered. A localized informational card explains that the provider can enable these business settings after onboarding and that the service will then follow them automatically. The AI setup modal receives `entryContext=onboarding`, skips billing reads/writes, hides billing controls, and never navigates away from the wizard.

---

## LOCATION LABELS — "At my location" (LABEL ONLY)

Provider surfaces now read **"At my location"**; customer surfaces read **"At provider's location"**. The old "At Store" wording is gone from the client apps.

> ‼️ **The data identifiers are deliberately NOT renamed.** `IsAtStore` / `isAtStore` (entity `Service`, `Cart`, `SearchDocument`, `ServiceDto`, `CartDtos`, `AIAssistantDtos`, `ProviderContextModels`), the web form-model field `inStore`, and the customer-app string literal `locationType: "atStore"` all stay exactly as they are. This was a copy change, not a schema change — renaming any of them breaks the search index, the cart wire format, and the voice provider context. The **i18n key names** were left alone too (`Label.InStore`, `AT_STORE`, `IN_STORE`); only the values changed.

Values live in: `clinqetwebpartnerapp\public\lang\en-US.json` (`Label.InStore`, `AISetup.AtMyLocation`), `clinqetmobilepartnerapp\src\Locales\en.json` (`IN_STORE`, `AT_STORE`, `AT_MY_LOCATION`), `clinqetwebuserapp\public\lang\en-US.json` (`cart.At_Providers_Location`, `cartCheckout.atStoreLabel`, `Label.InStore`, `businessProfile.AtProvidersLocation`, `quickBook.atStore`), `clinqetmobileuserapp\src\Locales\en-US.json` (`AT_STORE`, `AT_PROVIDERS_LOCATION`).

**Still on the old wording (known, NOT yet updated):**
- Backend `clinqetinfrastructure\Resources\Localization\en.json` → `"Label_IsAtStore": "Service at Store"` and `"Error_ServicePlaceRequired"` ("...at store or at customer location"). `Label_IsAtStore` is user-visible — it is the `[Display(Name = ...)]` on `ServiceDto.IsAtStore` and `BulkServiceDtos`, so it surfaces in validation messages. `hi.json` / `gu.json` carry the store wording too.
- Quote/lead surfaces use a different string entirely: `quotes.serviceLocationType.AtProviderPlace` ("At provider place") / `leads.serviceLocationType.AtProviderPlace` / mobile `LOC_AtProviderPlace` ("At provider").

---

## ADMIN APPROVAL WORKFLOW

State machine for `approvalStatus`:

```
PendingApproval         (Initial — set on Create unless AI auto-approves)
   ├─→ PendingAIValidation     (queued for AI validation via change feed)
   ├─→ Approved                (admin approves)
   └─→ Rejected                (admin rejects with reason)

PendingAIValidation
   ├─→ Approved                (AI validation passes)
   ├─→ AIRejected              (AI validation fails → fallback to manual)
   └─→ PendingProviderCompletion (AI flagged missing data)

Approved        → (terminal)
Rejected        → (re-edit re-triggers Pending)
AIRejected      → (admin can override; provider edits + resubmits)
```

Admin app page: `C:\Nik\clinqetwebadmin\src\pages\services\ServiceApprovalPage.jsx` — list of awaiting/AI-rejected services with approve/reject actions + reason input.

Notifications fired:
- `ServiceApprovedByAdmin` / `ServiceRejectedByAdmin` (via `CommunicationDispatcher` — cross-link `clinqet-notifications` skill).
- `ServiceApprovedByAI` / `ServiceRejectedByAI` — emitted from `SearchIndexSyncFunction` after AI validation.
- `ServiceCategoryAutoCorrected` — emitted when AI corrects mis-categorization.

AdminAlerts: `ServiceAwaitingApproval` on creation, `ServiceRejectedByAI` on AI failure.

---

## AI ENRICHMENT + SEARCH INDEX SYNC

**Trigger:** Cosmos change feed on `ProviderData` container — `SearchIndexSyncFunction.cs` (Function name `ProviderDataUnifiedProcessor`) — cross-link `clinqet-function-app` + `clinqet-search-discovery` skills.

Steps for a new/updated Service:
1. Per-service serialization via `IPerServiceLockRegistry` (no overlapping writes for same service).
2. If `isDeleted || !isActive || approvalStatus != Approved` → `IAzureSearchIndexer.DeleteServiceFromIndexAsync()` (remove from index).
3. Otherwise: fetch Service + BusinessProfile → call `IAzureSearchIndexer.IndexServiceAsync()`:
   - AI call for `CommonSearchPhrases` (Azure OpenAI / Azure AI Foundry).
   - AI call for `UserIntentPhrases`.
   - Embedding call (vector embedding for hybrid search — 3072-dim, HNSW).
   - Upsert to Azure AI Search index.
4. If `approvalStatus == PendingAIValidation`: run `ProcessAIValidationAsync()`:
   - Call `IAICompletionService.ValidateServiceAsync()` (validates description against category).
   - On valid → set `approvalStatus = Approved`, emit `ServiceApprovedByAI` notification.
   - On invalid → set `approvalStatus = AIRejected`, store rejection reason, emit `ServiceRejectedByAI` notification + admin alert.
   - On error → set `approvalStatus = PendingApproval` (fallback to manual), emit admin alert.

Transient retries: 500ms base exponential backoff, up to 2 retries. Every failed document is queued to `%ServiceBusSettings:ChangeFeedFailuresQueueName%` as its own replay (P4-107; the `EnablePerDocumentFailureTracking` switch is deleted); the replay alerts and dead-letters on its final delivery.

---

## CATEGORY & SUBCATEGORY LINKAGE

Categories live in the same `ProviderData` container with `parentCategoryId` denoting subcategory. Selection persisted as `SelectedCategory` (with subcategories list) per business.

Validation rules on Service create:
- `categoryId` must exist in Categories container.
- `subcategoryId` must have `parentCategoryId == categoryId`.
- Both can be global or business-specific (provider creates custom categories awaiting admin approval).

300+ categories live in seed data (`C:\Nik\cosmosindexsetup\SampleCosmosDataGeneratorSettings.cs`). Cross-link `clinqet-cosmos-data` skill.

---

## SERVICE IMAGES + MEDIA DERIVATIVES

Cross-link `clinqet-media-derivatives` skill for the full pipeline.

Flow:
1. Provider uploads via SAS URL → blob stored in `serviceimages` container.
2. Service controller persists Service with `ServiceImage.processingStatus = Pending`.
3. `MediaDerivativeQueueMessage` published with `ParentEntity = MediaParentEntity.Service`, `ParentContainer = "ProviderData"`, `ParentArrayField = "serviceImages"`, `ParentArrayIdField = "imageId"`.
4. `MediaDerivativeProcessorFunction` generates WebP thumb + medium, patches via `UpdateServiceImageDerivativesByIdAsync`.
5. `processingStatus → Ready` on success or `Failed` on error.

---

## SETTINGS

```
CosmosDb:ServiceDeleteTtlDays = 30
```

Plus AI / approval-related settings exposed through `AIServiceSettings` and `AIAssistantSettings` (see `clinqet-ai-assistant` skill).

---

## FRONTEND

### Partner app (`clinqetwebpartnerapp`)
- `C:\Nik\clinqetwebpartnerapp\src\app\dashboard\profile\manage-services-price\page.jsx` — service catalog editor.
- Onboarding wizard step 4: `src\components\onboarding\add-business-information\ManageServicesPrice\` — service CRUD + bulk-upload + pricing forms.
- Approval badge: `src\components\common\ServiceApprovalStatusBadge.jsx` — Live (Approved/empty) / Pending review (Pending*) / Rejected (Rejected/AIRejected; reason as tooltip + subtext); rendered on manage-services `ServiceList\ServiceCard.jsx` and dashboard-home `ServicesList.jsx`; keys `services.approval.*` in all four `public\lang\*.json`.
- Mobile-first responsive (memory `feedback_clinqet_engineering_standards`).
- All copy via `react-intl`.

### Admin app (`clinqetwebadmin`)
- `C:\Nik\clinqetwebadmin\src\pages\services\ServiceApprovalPage.jsx` — moderation queue.
- Approve / Reject with reason; AI-rejected drilldown.

### User app (`clinqetwebuserapp`)
- Public service browsing in search results (cross-link `clinqet-user-app` + `clinqet-search-discovery` skills).
- Service detail page reads via public endpoint.

---

## TESTS

Unit:
- `ServiceRepositoryTests` — soft-delete sets TTL, duplicate-name guard, price-range filter, subcategory counts, image-derivative patch race.
- `ServiceControllerTests` — validation (category exists, name unique, at-store-or-customer enforced), ETag round-trips, soft-delete behavior.

Integration (`ClinqetApiFactory` + Testcontainers):
- Create service → SearchIndexSyncFunction fires → service in Azure Search index.
- Approve via admin → notification dispatched, search index update.
- Reject by AI → AIRejected status set, alert generated.
- Soft-delete → service removed from search index within change-feed cycle.

Add string-shape SQL unit tests for new keyset queries.

---

## CROSS-LINKS

- Media derivatives: `clinqet-media-derivatives` SKILL — service image pipeline.
- Onboarding: `clinqet-provider-onboarding` SKILL — Services is step 3.
- Search: `clinqet-search-discovery` SKILL — SearchIndexSyncFunction + AI enrichment.
- AI: `clinqet-ai-assistant` SKILL — AICompletionService used in approval validation.
- Categories: `clinqet-cosmos-data` SKILL — Categories container shared.
- Notifications: `clinqet-notifications` SKILL — approval/rejection notifications.
- Public page: `clinqet-provider-public-page` SKILL — service listing on Open Page.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query partition-scoped (`/businessId`). NO cross-partition.
- [ ] Service create: category+subcategory existence + ownership validated.
- [ ] `ServiceNameExistsAsync` checked before insert.
- [ ] At least one of `isAtStore` / `isAtCustomersLocation` is true.
- [ ] Soft-delete sets `isDeleted=true, ttl=ServiceDeleteTtlDays*86400`.
- [ ] Image uploads queue `MediaDerivativeQueueMessage` correctly (Service parent entity, correct ParentArrayField).
- [ ] Service change feed → `SearchIndexSyncFunction` per-service lock honored.
- [ ] Approval state transitions emit correct `NotificationType` + `AdminAlertType`.
- [ ] AI enrichment via Azure OpenAI uses cached prompts; no hardcoded category names (§3.7 CLAUDE.md).
- [ ] All UI strings, DTO annotations, validation messages via localization keys.
- [ ] Every client that updates a Service sends BOTH `Taxable` and `AcceptsOnlinePayments`, including `null`, regardless of the billing flag (full-replace tri-state).
- [ ] `UpdateFromDto` still assigns both tri-state fields unconditionally (no `HasValue` guard reintroduced).
- [ ] Location copy uses "At my location" (provider) / "At provider's location" (customer) — and the `isAtStore` / `inStore` / `"atStore"` identifiers are UNCHANGED.
- [ ] `OnboardingProgressService.UpdateStepAsync(OnboardingStep.Services, ...)` called after Service Create/Delete.
- [ ] Mobile-first responsive; ESLint zero errors.
- [ ] Unit + integration tests for every new path.

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

## ‼️ D15 PART 2 — AI-PROPOSED CATEGORY CORRECTION WORKFLOW (2026-09-01)

Correct-after-the-fact, NEVER a gate (owner rulings, `C:\Nik\ai-cost-quality\D15-PART2-PROMPT.md` §6.1):
an AI-proposed category goes LIVE (`Approved = true` on create is unchanged) and the admin corrects it
later. `CategoryPromptService.LoadCategoriesAsync` deliberately keeps feeding globals + ALL customs —
hiding an invention makes the model mint a fresh near-duplicate every run; **MERGE is the control, not the
prompt.** Never add an `Approved` filter there. An 8-agent adversarial audit ran 2026-09-01; every
accepted finding is folded in below.

- **Identity contract**: `AiOwnedCategoryTaxonomy` (`clinqetcore\Utilities\`) is the single definition of
  the AI-owned deterministic id — `DeterministicGuid(businessId, "provider-setup-category", parentId ?? "",
  NAME.Trim().ToUpperInvariant())`. `ProviderSetupTaxonomyResolver` derives ids through it; the merge
  refuses any source whose id does not match (a provider RENAME takes ownership and de-lists the row).
  ‼️ **A parent merge re-homes children WITHOUT re-keying them**, so `IsAiOwned(category, alternateParentId)`
  also accepts the ALERT's mint-time parent as evidence (a SHA-1 preimage nobody can forge) — inspect and
  merge take `alertParentCategoryId`, which is what keeps re-parented invented children correctable.
  Pinned by absolute GUID literals in `AiOwnedCategoryTaxonomyTests` — never change the derivation.
- **Queue = the existing alerts. NO new storage of any kind.** The admin tab lists
  `CustomCategoryAwaitingReview`/`CustomSubcategoryAwaitingReview` alerts and classifies rows live via
  `POST admin/categories/ai-proposed/inspect` (partition point-reads; the population rule is the id
  pattern, NEVER a confidence score). Inspect counts a live parent's children INCLUSIVE of inactive ones
  (the merge re-parents those too), and stamps Gone/Inactive rows with their STRANDED service count The alert now also carries `TriggeringServiceName` (owner-ratified 2026-09-01): the resolver passes the extracted service that minted each node into `RaiseAwaitingReviewRequiredAsync`, all four entry points inherit it, and the tab renders it as "From service: …" (older alerts simply lack the key). ‼️ The SOURCE DOCUMENT is deliberately NOT carried — only the resolver's CALLERS know it, and widening `ResolveAsync` touches `McpService.cs` (concurrent-session-owned at the time) and `CatalogManifestService` (R6: change nothing); adding it later means threading a document name through those call sites.
  (either pointer) — the tab's repairability signal. A cross-business category listing would be a §0.6
  cross-partition query.
- **Merge** (`IAiProposedCategoryMergeService` → `AiProposedCategoryMergeService`, API host;
  `POST admin/categories/ai-proposed/merge`, `AdminCategoryCorrectionController`): ensure the target
  selection FIRST (order pinned by test) → repoint EVERY service (fresh point-read each; already-moved
  skipped ⇒ idempotent; per-service failures ⇒ `Partial`, source kept, a re-run moves the stragglers) →
  `RefreshSubcategoryCountsAsync` (recomputes from truth; removes the emptied source sub) → **HARD-DELETE
  the source doc** (only at zero remaining + zero failures) → best-effort direct `IndexServiceAsync` per
  moved service, gated on a FRESH re-read through `ServiceIndexGates.IsIndexable` (a mid-merge rejection
  is never resurrected; the ProviderData change feed is the guaranteed backstop — its enrichment hash
  includes category names, pinned by `IndexServiceAsync_ChangedCategoryName_ReRunsEnrichmentAndStampsTheNewName`).
  Hardening from the audit: a same-id GLOBAL twin refuses (`NotAiOwned`) rather than hijack the global
  category; a GONE source infers its shape from where stragglers actually are (never `AlreadyMerged` over
  live stragglers); the `AlreadyMerged` path PRUNES ghost selection entries — removes entries FOR the gone
  id and migrates a gone parent's surviving selection doc to each child's LIVE parent; the selection
  ensure retries once on the deterministic-id create race. Parent-source merge re-parents children
  (inactive included), blocks on target-scope name collisions (409 naming them), and its selection
  migration **re-derives from LIVE child docs** — the doc is deleted only when every entry migrated and no
  child failed, so a crashed or partial run is fully healed by the retry. `SourceDeleted` on the result
  means "the invented category no longer exists"; `Ok` with `SourceDeleted=false` (services appeared
  concurrently) must NOT be treated as finished. Approval status of moved services is NEVER touched.
- ‼️ **Removal is a HARD delete, deliberately** (the `ConvertCustomToGlobalAsync` precedent): a
  soft-deactivated doc keeps the deterministic id occupied, and the next document proposing the same name
  409s the whole setup run (`GetOrCreateCustomAsync`'s recovery read filters inactive). Consequence: a
  dealer RE-IMPORT whose manifest still carries the merged-away name re-creates the category and
  re-raises the alert — and because the deterministic alert EventId conflict-heals into the already
  RESOLVED alert doc within the same month, the TAB fetches resolved alerts too and re-surfaces any
  resolved row whose category is alive again.
- **Promote-to-global (R4)**: `POST categories/admin/convert-to-global/{id}` REFUSES without
  `ConvertToGlobalDto.AcknowledgeGlobalImpact` (server is the authority) and — audit fix — refuses a
  child whose parent is still a business custom with `Error_GlobalPromotionParentFirst` (the conversion
  re-homes the doc before validating, which otherwise fails deep inside as a misleading "parent not
  found": promote the parent first). Success writes an IMMUTABLE `CategoryPromotedToGlobal` audit alert —
  direct repository write with the admin-access audit TTL and an explicit `CreatedAt` (the mock alert
  repo does not backfill it), actor + reason + category in metadata; delete-blocked via
  `IsImmutableAuditAlert`. Never a side effect of approving, merging or editing.
- Settings: `CategoryCorrection:InspectMaxItems` (Main API appsettings, class default 100 mirrors it).
  Localization: 8 keys total in ALL five language files (`Error_AiCategory*` ×4,
  `Error_GlobalPromotionAcknowledgementRequired`, `Error_GlobalPromotionParentFirst`,
  `Label_AcknowledgeGlobalImpact`; `Error_CategoryIdLength` pre-existed and is reused on the id fields).
  New repo method: `IServiceRepository.GetCountByCategoryAsync` (partition-scoped scalar). The
  body-carried `BusinessId` on the merge request is REGISTERED in
  `ProviderEndpointAuthorizationTests.CustomerSuppliedBusinessIdBodies`.
- Tests: `AiProposedCategoryMergeServiceTests` (incl. ordering pin, evidence, prune, global-twin,
  shape-inference, partial-keeps-selection-doc) + `AdminCategoryCorrectionControllerTests` +
  `AiOwnedCategoryTaxonomyTests` (unit) · `AdminCategoryCorrectionTests` (integration, real Cosmos
  emulator: child E2E + **parent-source E2E** + idempotent re-run + NotAiOwned refusal with a VALID
  target + promote audit + delete-block; search propagation asserted at the now-RECORDING
  `MockSearchIndexService` seam — Azure AI Search has no emulator, the factory pins it to `.invalid`).

## PRICING EDIT + THE PAUSE WRITE (Phase 4, 2026-09-27)

- **What an omitted pricing field means** (`PricingMappingExtensions.UpdateFromDto`). The web and phone forms send only
  the fields of the chosen price type and OMIT the rest — that omission is how they clear a switched-away type's values,
  so `FixedPrice`/`StartPrice`/`MaxPrice`/`HourlyRate`/`MinimumHours`/`ChargePerVisit`/`MinDistance`/`ChargePerDistance`/
  `MinimumCharge` are replaced by what is sent. ‼️ Neither form sends `TaxRate` or `DiscountValue` (AI setup and document
  reading store them), so those two now KEEP their stored value when omitted, like `TaxIncluded`, `DiscountType` and
  `Notes` already did — every web edit used to wipe a stored per-service tax rate. Tests:
  `Extensions/ServicePricingEditMappingTests` (API unit), `Controllers/ServicePricingEditIntegrationTests` (emulator).
- **`ServiceRepository.SetActiveAsync` (D-82) patches under the read's ETag**, retrying on a fresh read up to
  `CosmosDb:MaxConcurrencyRetries` and then answering 412 (`Error_DbConcurrencyConflict`). A delete after the read refuses
  the patch and the fresh read answers 404. ‼️ Not a `c.isDeleted = false` filter predicate: the integration emulator
  (`vnext`) rejects a boolean in a patch predicate with a 500, so it could never be proven.

## Duplicate, MCP edits and the pause (2026-09-27)

- ‼️ **A duplicated service is a NEW listing.** `POST business/services/{id}/duplicate` keeps the source's `IsActive`
  (a paused source gives a paused copy) but runs `ProcessServiceApprovalAsync` like any create — before, it skipped
  that step: pending, but with no AI validation and no admin alert, so it waited unseen.
  Test: `ServiceControllerTests.DuplicateService_KeepsTheSwitch_ButGoesThroughApprovalLikeANewService`.
- **MCP `update_service` cannot pause or resume** — its `isActive` parameter is gone; D-82's
  `PUT business/services/{id}/active` is the one writer. Test: `ServiceManagementToolsTests.UpdateService_OffersNoWayToPauseOrResume`.
