---
name: clinqet-provider-onboarding
description: |
  **CORE FEATURE SKILL** — Work on the Provider Onboarding feature end-to-end.
  Seven-step onboarding wizard (BusinessDetails → BusinessCategory → Services →
  ServiceArea → Availability → Portfolio → BusinessAddress) with progress
  tracking, ETag concurrency with 412-retry, auto-create BusinessProfile on
  first access, address geocoding, service area selection (radius / polygon /
  zipcode), partial submission, draft support.
  USE FOR: onboarding step CRUD, progress calculation, OnboardingStatus
  embedded entity, 7-step wizard navigation, profile dashboard edit pages,
  address geocoding integration, service-area map UI, auto-create profile,
  recalculate-all flow, ETag conflict retries.
  Applies to clinqetinfrastructure/Services/OnboardingProgressService.cs,
  clinqetcore/Interfaces/Services/IOnboardingProgressService.cs (defines
  OnboardingStep enum), clinqetcore/Entities/COSMOS/Cosmos.cs
  (OnboardingStatus + OnboardingSteps embedded in BusinessProfile),
  clinqetapi Controllers/BusinessProfileController.cs (auto-create),
  clinqetwebpartnerapp src/app/onboarding/page.jsx (5-tab wizard),
  src/components/onboarding/add-business-information (BusinessDetails,
  ServiceArea, BusinessCategory, ManageServicesPrice, SetAvailability),
  src/app/dashboard/profile/* (per-step edit pages).
---

# CLINQET PROVIDER ONBOARDING — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (the Clinket team can do the setup for a provider)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **An administrator may hold a 60-minute SETUP SESSION** on a provider's workspace and walk the same onboarding steps. It is DEFAULT DENY: only `[AllowedInSetupSession]` endpoints answer it.
- **It is minted only into a business the person is the PRIMARY OWNER of**, never into an account holding admin access.
- **Online booking is forced OFF while nobody has taken the account over** — ‼️ gated on `IsAdminProvisioned && ClaimedAt is null`, because `ClaimedAt is null` ALONE is every self-registered provider, and helping a live business would have switched their booking off.
- **The feed records one line per session** ("The Clinket team helped with your business setup"), attributed to the administrator.

## RECENT CHANGES - 2026-08-14 (pricing-remediation navigation invariant)

- Complete AI-uploaded services are `Approved`; incomplete pricing uses the existing `PendingProviderCompletion`. A setup run emits live remediation only when at least one incomplete service was successfully persisted.
- One upload produces at most one transient SignalR/push summary per recipient, never one live event per incomplete service. Individual incomplete services remain separate silent notification-center rows for later exact editing.
- The onboarding wizard is a hard navigation boundary on provider web and mobile. A live summary may render, but tapping it while onboarding dismisses/does nothing. A background or killed-state mobile push cannot enter the dashboard shell and no deferred notification redirect is kept for after onboarding.
- Outside onboarding, the summary opens Notifications; each durable row then opens the exact existing service editor after workspace and `catalog.service.update` checks.

## RECENT CHANGES — 2026-08-13 (AI Quick Setup profile and area hardening)

- `ProviderSetupProfileService` applies extracted provider facts as fill-missing-only updates. Existing provider-authored profile/address values win. A complete new address uses deterministic identity, is geocoded before persistence, and the profile write uses bounded ETag retries. Currency is restamped only when an extracted address supplies the country; replay also repairs affected service currency without inventing an address.
- `ProviderSetupServiceAreaService` is the single setup-area resolver for flyer/PDF and catalog-manifest inputs. It reads only the current business partition, accepts explicit extracted country first and the profile address as fallback, validates the configured confidence, geocodes city/state/country, uses deterministic IDs, and avoids merging same-named places in different cities.
- Manifest record areas still override the dialog selection, and records without their own area still inherit the validated dialog selection. Area creation is idempotent and the first active area remains the only default.
- The extraction prompt also receives the provider's bounded context so location facts can be interpreted without overwriting stronger structured data. Missing or low-confidence area evidence produces no write.

## RECENT CHANGES — 2026-07-29 (dealer CATALOG MANIFEST onboarding path)

A large provider whose inventory already exists as structured data can be onboarded by uploading a **catalog manifest** (versioned JSON) through the existing AI Quick Setup surface instead of a flyer. Full mechanism in `clinqet-ai-assistant`; what onboarding owns:

- **No new UI and no new endpoint.** The manifest rides the existing `POST /api/v1/ai/provider-setup/upload-urls` → `/provider-setup/process` flow, the existing `provider-setup-docs` container, and the existing business-scoped `IBlobUrlValidator` check. `.json` was added to `Storage:ProviderSetupDocuments` allowed types.
- **Service areas are created through `ProviderSetupServiceAreaService`**, not a manifest-only name matcher. The resolver scopes reads to the business, distinguishes same-named places by their structured location, geocodes new areas, assigns deterministic IDs, and reuses an existing active match on replay. `IsDefault` is stamped only when the business has no active area, so the single-default invariant is preserved.
- **Coordinates are resolved at setup time when an area is created.** Explicit city/state/country evidence is geocoded once; a failed or unusable geocode does not invent coordinates, and replay reuses the deterministic area instead of paying for another document.
- ‼️ **Service-area precedence: the RECORD wins, the DIALOG is the fallback.** A record naming its own `serviceAreaName` always uses that area and ignores whatever the AI-setup dialog had selected. A record naming NONE inherits the operator's dialog selection via the existing `ResolveSetupServiceAreaIdsAsync` (requested ∩ owned → default area → oldest). `ProjectAsync` deliberately leaves `ServiceAreaIds` **empty** for those rows instead of picking a default itself — deciding there would silently override a choice the operator deliberately made. This is why `resolvedServiceAreaIds` is computed for manifests too (it used to be forced empty) and why it must stay AFTER projection, so the areas the manifest just created are visible to it.
- **Onboarding progress, subcategory counts and the change feed are all reached through the existing code paths** — the manifest branch only replaces extraction, never the write-side steps.


## RECENT CHANGES — 2026-07-23 (W-01 "Accept online bookings" toggle UX overhaul + gated admin alert)

- **Toggle card redesigned on ALL FOUR partner surfaces** (approved mockup: `clinqetwebpartnerapp\mockups\online-bookings-toggle\`): ON state stays a two-line benefit-framed card; toggling OFF expands an INLINE amber warning (no modal, derives purely from the value so it re-shows on every visit while off) with three honest consequence bullets (search "Phone only" badge · Book/Add-to-cart → Call button · **no new leads from quote matching** — code-verified, stricter than the old hint admitted), a "what your customers will see" mock preview row (the PaymentSettings preview-panel pattern), and a one-tap lime "Turn back on" button.
- **Web** = shared `clinqetwebpartnerapp\src\components\common\OnlineBookingsToggleCard.jsx` (props `{checked, onChange(bool), ariaLabel}`) replacing the duplicated blocks in onboarding `BusinessDetails.jsx` AND `Profile\BusinessInfo.jsx`. **Mobile** = the single `completeProfileFlow\BusinessDetails` screen (serves both routes); dark mode per the app's amber precedents. Keys: web `BusinessDetails.OnlineBookingsOff.*` (en/hi/gu/**ja** — ja also gained the base label+hint pair) · mobile `EDIT_BUSINESS_DETAILS.ONLINE_BOOKINGS_OFF_*` (en/hi/gu/**ja/es** — both gained the whole block). NO emoji anywhere.
- **Backend adoption watch**: `AdminAlertType.OnlineBookingsDisabled` (Severity Low, hardcoded-English per §3.6, stable Title/Description for processor content-dedupe) fired fire-and-forget on `admin-alerts` from `BusinessProfileController` — on profile-CREATE with bookings off and on update TRANSITION true→false ONLY (re-saves while off stay silent, test-pinned; every-save semantics were deliberately rejected as ops noise). Gated by `BusinessProfile:AlertOnOnlineBookingsDisabled` (`BusinessProfileSettings`, default TRUE, appsettings-only — flip off post-launch with no deploy). Alert failure can never fail a save. Registered in the admin AlertsPage type filter. Proof: 19/19 W-01 unit tests (5 new) + integration assertion via `MockServiceBusService` (42/42 against Testcontainers).

## OVERVIEW

Provider onboarding is **always-resumable** progress tracking embedded into `BusinessProfile`. The 7 logical steps are tracked in a nested `OnboardingStatus` object; the partner-app wizard presents 5 of them as primary tabs, with Portfolio and BusinessAddress configured in the profile dashboard.

Completion is determined by data presence — e.g. "Services step done" iff `ServiceRepository.GetByBusinessIdAsync(businessId).Any()`. Progress is `completedSteps / 7 * 100` (rounded).

ETag concurrency protects the embedded `OnboardingStatus` from concurrent writers (e.g. two service edits hit availability + services updates simultaneously). 412 Precondition Failed triggers a single re-fetch + retry; failing twice logs a warning but is non-fatal (this is a tracking subsystem, not a transactional one).

---

## STEP ENUM (`clinqetcore\Interfaces\Services\IOnboardingProgressService.cs`)

```csharp
public enum OnboardingStep
{
    BusinessDetails,    // Step 1 — name, description, GST, contact info
    BusinessCategory,   // Step 2 — select category + subcategory
    Services,           // Step 3 — define services + pricing
    ServiceArea,        // Step 4 — radius / polygon / zipcode areas
    Availability,       // Step 5 — weekly working hours
    Portfolio,          // Step 6 — portfolio projects (gallery)
    BusinessAddress     // Step 7 — at least one address with coords
}
```

`TOTAL_STEPS = 7` constant in `OnboardingProgressService`. **Never change the enum order — the index is meaningful for legacy clients.**

---

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `OnboardingStatus` (~lines 149-167) — nested inside BusinessProfile
```csharp
public class OnboardingStatus
{
    [JsonProperty("progress")] public int Progress { get; set; }   // 0-100%
    [JsonProperty("steps")]    public OnboardingSteps Steps { get; set; }
}
```

### `OnboardingSteps` (~lines 168-180)
```csharp
public class OnboardingSteps
{
    [JsonProperty("businessDetails")]  public bool BusinessDetails { get; set; }
    [JsonProperty("businessCategory")] public bool BusinessCategory { get; set; }
    [JsonProperty("services")]         public bool Services { get; set; }
    [JsonProperty("serviceArea")]      public bool ServiceArea { get; set; }
    [JsonProperty("availability")]     public bool Availability { get; set; }
    [JsonProperty("portfolios")]       public bool Portfolio { get; set; }
    [JsonProperty("businessAddress")]  public bool BusinessAddress { get; set; }
}
```

### `BusinessProfile` (relevant subset)
- Container: `ProviderData`. Partition key: `/businessId`. Document id: `{businessId}`.
- Has `OnboardingStatus` nested property; ETag drives concurrency.

### `Address` + `GeoCoordinates` (~lines 111-147)
Address: `Street, City, State, Country, ZipCode, Coordinates: GeoCoordinates?, IsPrimary: bool`.
GeoCoordinates (entity): `Latitude: double, Longitude: double` — non-nullable, unchanged.

`GeoCoordinatesDto` (`clinqetshared\DTOs\COSMOS\Cosmos.cs`) is the part that changed: **both members are `double?` and carry `[Required]` as well as `[Range]`**. A non-nullable `double` bound a missing member to `0`, so a half-supplied pair silently became Null Island; `[Range]` alone passes on `null`, which is why `[Required]` is also needed.

**Never hand-roll a DTO→entity coordinate conversion.** Every conversion goes through the single seam `GeoCoordinateMapping.ToEntity()` (`clinqetcore\Utilities\GeoCoordinateMapping.cs`), an extension on `GeoCoordinatesDto?` returning `GeoCoordinates?`, backed by `CoordinateSentinel.IsUsablePair` (`clinqetshared\Extensions\CoordinateSentinel.cs`). An unusable pair yields a **null location, never (0,0)**. The seam is used at 25 call sites (`BookingMappingExtensions` ×12, `QuoteMappingExtensions` ×6, `CustomerController` ×2, `ServiceAreaController` ×2, `BusinessProfileController`, `InvoiceMappingExtensions`, `BroadcastService`). The remaining `new GeoCoordinates` sites are entity→entity copies or geocoder results, not DTO input — leave them.

### `ServiceArea` (~lines 396-450)
- Container: `ProviderData`. Partition key: `/businessId`. Composite id: `{businessId}_{serviceAreaId}`.
- Fields: `serviceAreaId, businessId, name, areaType: string` (`"Radius"` or `"Polygon"`), `city, state, country, zipCode, coordinates?, isDefault: bool, isDeleted, deletedAt?, ttl?`.
- `isDefault` is a plain non-nullable `bool` (no `NullValueHandling.Ignore`, unlike the sibling `isDeleted`). Exactly one active area per business is the default — see **SERVICE AREA DEFAULT** below.

---

## SERVICE — `OnboardingProgressService.cs` (`clinqetinfrastructure\Services\`)

Interface: `IOnboardingProgressService` (`clinqetcore\Interfaces\Services\`).

### Public methods

- `UpdateStepAsync(businessId, OnboardingStep step, bool isCompleted, BusinessProfile? profile = null)` — single-step toggle + progress recalculation.
  - Outer retry loop (2 attempts) on `CosmosException.StatusCode == PreconditionFailed (412)`.
  - First retry: 100ms + random(0–50ms) jitter, re-fetches profile to get fresh ETag.
  - Second failure: logs warning, returns without throwing (non-critical operation).

- `UpdateMultipleStepsAsync(businessId, Dictionary<OnboardingStep, bool> stepUpdates, BusinessProfile? profile = null)` — atomic batch update of multiple steps with same 412 retry semantics.

- `RecalculateAllStepsAsync(businessId)` — full re-derivation from data:
  - BusinessDetails: `!string.IsNullOrWhiteSpace(profile.Name) && !string.IsNullOrWhiteSpace(profile.Description)`
  - BusinessCategory: `_selectedCategoryRepository.GetByBusinessIdAsync(businessId).Any()`
  - Services: `_serviceRepository.GetByBusinessIdAsync(businessId).Any()`
  - ServiceArea: `_serviceAreaRepository.GetByBusinessIdAsync(businessId).Any()`
  - Availability: `_availabilityRepository.GetByBusinessIdAsync(businessId).Any()`
  - Portfolio: `_PortfolioRepository.GetByBusinessIdAsync(businessId).Any()`
  - BusinessAddress: `profile.Addresses?.Any() == true`

- `GetOnboardingStatusAsync(businessId) → OnboardingStatus?` — returns current snapshot without modification.

### Progress calculation
```csharp
var completedSteps = CountCompletedSteps(profile.OnboardingStatus.Steps);
var newProgress = (int)Math.Round((double)completedSteps / TOTAL_STEPS * 100);
```

---

## CONTROLLER — `BusinessProfileController.cs` (`clinqetapi\Clinqet.API\Controllers\`)

### Auto-create on first access (~lines 106-137)
`GET /api/v1/business/profile` — if profile doesn't exist, returns an auto-created stub:
- `Id = businessId`, `Name = ""`, `Description = null`
- `OnboardingStatus.Progress = 0`
- `OnboardingStatus.Steps = all false`
- `Addresses = []`

Subsequent updates flow through `PUT /api/v1/business/profile`. Other onboarding actions go through dedicated controllers (AvailabilityController, ServiceController, ServiceAreaController, PortfolioProjectController, SelectedCategoryController) — each calls `OnboardingProgressService.UpdateStepAsync` after a successful write.

---

## FRONTEND WIZARD (`clinqetwebpartnerapp\src\app\onboarding\page.jsx`)

URL pattern: `/onboarding?step={1-5}` (only 5 visible tabs).

### 5 visible tabs
| # | Step | Component | URL |
|---|------|-----------|-----|
| 1 | BusinessDetails | `BusinessDetails.jsx` | `?step=1` |
| 2 | ServiceArea | `ServiceArea.jsx` | `?step=2` |
| 3 | BusinessCategory | `BusinessCategory.jsx` | `?step=3` |
| 4 | Services + Pricing | `ManageServicesPrice/` | `?step=4` |
| 5 | SetAvailability | `SetAvailability.jsx` | `?step=5` |

**Portfolio (Step 6)** and **BusinessAddress (Step 7)** are configured in the profile dashboard pages (`src\app\dashboard\profile\portfolio\` and embedded in `BusinessDetails.jsx`), not in the wizard.

### State management
- `currentActiveTab` — current step (1-5).
- `userProfileInfo` — cached profile data.
- `useSearchParams() + useRouter().replace()` for navigation.
- `handleTabChange(n)` updates URL search param + reloads relevant data.
- Suspense boundary with loading spinner.
- Product tour integration (`ACT_FOR_ONBOARDING_STEP`).
- Page title + meta description updated per step (SEO).

### Components folder
`C:\Nik\clinqetwebpartnerapp\src\components\onboarding\add-business-information\`:
- `BusinessDetails.jsx` — Step 1 form (name, description, GST, years of experience, employee count, phone, email).
- `ServiceArea.jsx` — Step 2 with map-based radius/polygon picker. Uses Google Maps via `SelectServiceAreaMap/` subcomponent.
- `BusinessCategory.jsx` — Step 3 hierarchical category/subcategory picker. Persists via SelectedCategoryController.
- `ManageServicesPrice/` — Step 4 service CRUD with bulk upload + pricing forms.
- `SetAvailability.jsx` — Step 5 weekly hours; reused on profile page with `navigationNotShow={true}` (cross-link `clinqet-availability-calendar` skill).
- `CelebrationCard.jsx` — Completion celebration screen.
- `ConfirmationModal.jsx` — Reusable confirmation dialog.
- `SelectServiceAreaMap/` — Google Maps integration with radius circle + polygon drawing tools.

### Profile dashboard edit pages
- `src\app\dashboard\profile\business-information\page.jsx` — re-uses `BusinessDetails.jsx`.
- `src\app\dashboard\profile\business-category\page.jsx` — re-uses `BusinessCategory.jsx`.
- `src\app\dashboard\profile\business-address\page.jsx` — address form.
- `src\app\dashboard\profile\set-availability\page.jsx` — re-uses `SetAvailability.jsx`.
- `src\app\dashboard\profile\manage-services-price\page.jsx` — service catalog editor.
- `src\app\dashboard\profile\portfolio\` (if present) — portfolio CRUD.

---

## ADDRESS GEOCODING — `GoogleGeocodingService.cs`

Path: `clinqetinfrastructure\Services\Geocoding\GoogleGeocodingService.cs`.

```csharp
Task<GeocodingResult> GeocodeAddressAsync(Address address, CancellationToken ct = default);
Task<GeocodingResult> GeocodeAddressAsync(string street, string city, string state, string zipCode, string country, CancellationToken ct = default);
Task<GeocodingResult> GeocodeCityAsync(string city, string state, string country, CancellationToken ct = default);
```

- Endpoint: `https://maps.googleapis.com/maps/api/geocode/json`.
- Settings: `GeocodingSettings.TimeoutSeconds` (default 10s).
- Output: `GeocodingResult { Success, Latitude, Longitude, FormattedAddress, Error? }`.
- Error handling: logs warning, returns `GeocodingResult.Failed(reason)` — never throws to caller.

Invoked when an Address is added/updated on the BusinessProfile (Step 1 / Step 7) or when a ServiceArea is defined with coordinates.

The stored lat/long also drives timezone stamping: `BookingTimeHelper.StampProfileTimeZone` sets `BusinessProfile.TimeZoneId` — India resolves to `Asia/Kolkata` by country check first (geo border polygons are imprecise near India's borders), otherwise the zone is geo-derived from the primary address coordinates via the offline `GeoTimeZone` NuGet, with the `BusinessTime` state→zone map/default as fallback when coordinates are missing or invalid. `Voiceline.TimeZoneId` inherits this profile zone. Providers in US/CA can view/override the zone via `GET/PUT api/v1/business/profile/timezone` (`BusinessTimeZoneDto { timeZoneId, timeZoneSource, canOverride, allowedTimeZones }`; curated per-country list from `BusinessTime:AllowedTimeZonesByCountry`); `canOverride` false ⇒ India renders NO timezone UI anywhere (owner mandate). A `Manual` override survives address re-saves; `PUT { timeZoneId: null }` resets to detected. UI touchpoints: partner-web BusinessAddress row + searchable dropdown, onboarding BusinessDetails detected-confirmation, SetAvailability caption strip; partner-mobile EditBusinessAddress row + bottom sheet, SetAvailability caption.

---

## SERVICE AREA SELECTION

ServiceArea supports three modes:
1. **Radius** (`areaType = "Radius"`) — single point + radius (km/mi).
2. **Polygon** (`areaType = "Polygon"`) — user-drawn polygon.
3. **Zip code array** — fallback when coordinates are unknown.

Frontend: `SelectServiceAreaMap.jsx` integrates Google Maps Drawing API. `DistanceRangeMap.jsx` handles radius selection.

Completion check: `_serviceAreaRepository.GetByBusinessIdAsync(businessId).Any()`.

---

## SERVICE AREA DEFAULT (`ServiceArea.IsDefault`)

Exactly one active service area per business is the default. There is **NO dedicated route** — the flag rides the existing create/update DTOs.

**Promotion is repository-only.** `ServiceAreaRepository.SetDefaultServiceAreaAsync` (`clinqetinfrastructure\Data\COSMOS\ServiceAreaRepository.cs`) is the only writer. It builds a single-partition `TransactionalBatch` on `new PartitionKey(businessId)` (ProviderData PK is `/businessId`), issuing one `PatchOperation.Set("/isDefault", area.ServiceAreaId == serviceAreaId)` per area, wrapped in the repository retry policy — so promote + demote land atomically and there is **never a moment with two defaults**. Never write `/isDefault` from anywhere else.

- **100-area ceiling.** `private const int MaxAreasPerBatch = 100;` — above 100 areas it throws `InvalidOperationException` rather than splitting the batch and losing atomicity. Exactly 100 still passes. Do not "fix" this by chunking.
- Returns `false` when the target area is not in the partition; short-circuits `true` when it is already the sole default.

**DTO contract.** `ServiceAreaDto` and `UpdateServiceAreaDto` (`clinqetshared\DTOs\COSMOS\Cosmos.cs`, both `record`s) carry `bool? IsDefault = null` with `[Display(Name = "Label_IsDefaultServiceArea")]`.
- **Only `true` is actionable.** `false` or omitted NEVER clears a default — you supersede a default by promoting another area. No code path writes `IsDefault = false` from a DTO; demotion happens exclusively inside the repository batch.
- Every other field on `UpdateServiceAreaDto` is nullable (`Name`, `Coordinates`, `Radius`, `Unit`, `City`, `State`, `Country`, `ZipCode`), so a single-field PUT body `{ "isDefault": true }` is valid. (In C# the positional record still needs all 8 leading args — only `IsDefault` has a default value.)

**Lifecycle in `ServiceAreaController` (`clinqetapi\Clinqet.API\Controllers\ServiceAreaController.cs`):**
- **CREATE** stamps `IsDefault = existingAreas.Count == 0`. If the caller asks for `IsDefault == true` and areas already exist, promotion is deferred to `SetDefaultServiceAreaAsync` so the batch keeps the invariant.
- **UPDATE** acts only on `updateDto.IsDefault == true && !updatedArea.IsDefault`.
- **DELETE self-heals**: if areas remain and none is default, the oldest by `(CreatedAt, Id)` ordinal is promoted — `OrderBy(a => a.CreatedAt).ThenBy(a => a.Id, StringComparer.Ordinal).First()`.
- **`UpdateServiceArea` deliberately does NOT call onboarding progress.** Editing an area cannot change whether one exists, and every creation path already marks the step; re-asserting it would cost a profile read on every edit to write nothing. There is an in-code comment saying so — **do not "restore" it**.

**Auto-created default.** `BusinessProfileController.CreateDefaultServiceAreaIfNeededAsync` (invoked after a primary business address is saved, guarded by `if (!existingAreas.Any())`) stamps `IsDefault = true`, resolves the name via `_localizationService.GetLocalizedString("Label_DefaultServiceAreaName", GetPreferredLanguage())` (was hardcoded English), and marks the step complete with `UpdateOnboardingProgressAsync(OnboardingStep.ServiceArea, true, profile)` — passing the **already-loaded** profile to avoid a second read.

**Indexing: nothing is owed.** `/isDefault` is deliberately absent from `CosmosContainerPolicies.ProviderData` IncludedPaths (`clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs`, opt-in policy with `ExcludedPaths = /*`). Callers already read the whole partition, so an index would only add write RU (§0.11). **No `cosmosindexsetup` run is required for this field.**

---

## LICENSE DOCUMENT UPLOAD (not in wizard)

Provider can upload license documents on a separate profile section (not part of the 7 tracked steps). Documents (PDFs typically) flow through the media-derivatives pipeline (cross-link `clinqet-media-derivatives` skill) — PDFs skip thumbnail/medium generation but still get metadata. License records embedded in `BusinessProfile.Licenses` array (see `LicenseDocument` ~lines 477-526).

---

## ETag CONCURRENCY

`OnboardingStatus` is embedded inside the `BusinessProfile` document. Concurrent writes to BusinessProfile (e.g. service created in tab A, availability updated in tab B) compete for the same ETag.

Retry pattern in `OnboardingProgressService.UpdateStepAsync`:
1. Fetch profile (or use provided).
2. Mutate `OnboardingStatus`.
3. Replace via `UpdateItemAsync` with ETag.
4. On 412:
   - Attempt 1: sleep 100ms + jitter(0-50ms), refetch, retry.
   - Attempt 2: log warning, give up (non-critical — `RecalculateAllStepsAsync` will repair on next access).

**Never throw** from `OnboardingProgressService` — it must be tolerant of concurrent traffic; the source-of-truth is the data itself, not the cached `OnboardingStatus`.

---

## TESTS

### Billing-context boundary (2026-07-22)

- Web wizard steps pass `entryContext="onboarding"` through every AI Quick Setup entry point; native onboarding routes pass the same context through navigation params.
- In onboarding context, the AI modal performs no payment/tax API reads or writes, renders no payment/tax controls, and closes without routing to profile settings.
- Service forms show a localized information card instead of payment/tax controls or profile links: add the service now, then enable business payment/tax settings after onboarding; the service follows those defaults because its overrides remain `null`.
- Profile/dashboard entry points explicitly pass or default to `entryContext="profile"`, preserving normal settings controls and navigation.

Regression checks must cover every wizard entry route on web and native so no modal action can strand the provider outside onboarding.

---

Unit:
- `OnboardingProgressServiceTests` — every step update, progress calculation, 412 retry/give-up paths, RecalculateAllStepsAsync correctness.
- `BusinessProfileControllerTests` — auto-create on first GET, update flow.
- `AvailabilityControllerTests`, `ServiceControllerTests`, `ServiceAreaControllerTests`, `SelectedCategoryControllerTests` — each verifies `UpdateStepAsync` is called with the right step + completion flag after a successful write.

Integration (`ClinqetApiFactory` + Testcontainers):
- Full 7-step happy path: create profile → fill each step → progress = 100%.
- Concurrent two-tab update (forced ETag clash) → both eventually persisted, no profile corruption.
- Delete last item of a step → step flips back to incomplete.
- `RecalculateAllStepsAsync` returns correct steps after manual data tampering.

---

## CROSS-LINKS

- Availability step: `clinqet-availability-calendar` SKILL.
- Service step: `clinqet-service-listing` SKILL.
- BusinessProfile + AppType-relevant settings: `clinqet-shared-core` SKILL.
- Public profile generated from onboarded business: `clinqet-provider-public-page` SKILL.
- Search index sync triggered after onboarding-driven Service updates: `clinqet-search-discovery` SKILL.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query partition-scoped (`/businessId` on ProviderData). NO cross-partition.
- [ ] `OnboardingStep` enum order preserved (NEVER reorder or rename — index is wire contract).
- [ ] Every action that satisfies a step calls `OnboardingProgressService.UpdateStepAsync(businessId, step, true)`.
- [ ] Every action that removes the last item of a step calls `UpdateStepAsync(businessId, step, false)`.
- [ ] 412 retry semantics preserved (no fail-throw; warning log on exhausted retries).
- [ ] Address geocoding called when address added/updated; coordinates persisted.
- [ ] ServiceArea `areaType` is one of `"Radius"`, `"Polygon"`, or empty (zipcode fallback).
- [ ] `/isDefault` written ONLY via `ServiceAreaRepository.SetDefaultServiceAreaAsync` (single-partition `TransactionalBatch`) — never patched or assigned directly, never from a DTO `false`.
- [ ] Every DTO→entity coordinate conversion goes through `GeoCoordinateMapping.ToEntity()` — no hand-rolled `new GeoCoordinates { Latitude = dto... }`.
- [ ] Deleting an area leaves exactly one default (oldest by `(CreatedAt, Id)` promoted when the deleted one was default).
- [ ] `UpdateServiceArea` still does NOT call onboarding progress (do not restore it).
- [ ] All wizard step labels + validation errors via `react-intl` keys.
- [ ] Wizard navigation preserves draft state on tab change (no data loss).
- [ ] Mobile-first responsive (memory `feedback_clinqet_engineering_standards`).
- [ ] ESLint zero errors on UI.
- [ ] Unit + integration tests for every new flow.

---

## ‼️ THE SERVICE-AREA FORM'S LOCATION CONTROL (PHASE 8 PART C — PROVIDER, 2026-08-04)

### ‼️ The single rule most likely to be got wrong

> At **0 or 1** location the "Which location covers it?" control **DOES NOT EXIST**.
> Not disabled. Not pre-filled-and-hidden. **ABSENT.**

| Active locations | The control | What the area is attached to |
|---|---|---|
| **0** | absent | `null` — the whole business, permanently, and correctly |
| **1** | absent | **That one — the SERVER attaches it, because there is nothing to choose** |
| **2+** | present, pre-selected to the default | what was chosen, or `null` for "the whole business" |

The gate is `serviceAreaLocationField(locations, branchId)` in the shared `renderingRules` module. It returns
`{ visible, selectedBranchId, options }` and is identical in both provider apps.
‼️ **One open location plus one CLOSED one counts as ONE** — the control stays absent.

Where: web `Select-Service-Area-Map/SelectServiceAreaMap.jsx`; mobile
`Screen/completeProfileFlow/AddServiceArea/index.tsx` (chips, not a picker — three options do not warrant a
modal).

### ‼️ The FIELD existed since Phase 4; NOTHING EVER WROTE IT

`ServiceArea.branchId` is Phase 4's (L79), but `ServiceAreaDto` carried no `BranchId` and neither
`CreateServiceArea` nor `UpdateServiceArea` ever assigned one — so the approved dropdown had **no backend at
all** until Part C PROVIDER. Generalises: *"the field exists"* and *"something writes it"* are different claims.

### The wire, and the three intents it must distinguish

```
POST /business/service/areas          body: { …, branchId? }
PUT  /business/service/areas/{id}     body: { …, branchId?, clearBranch? }
```

| Intent | What to send |
|---|---|
| This area is covered by location X | `branchId: "X"` |
| Hand this area back to the whole business | **`clearBranch: true`** |
| This update is not about the location | **send neither** |

‼️ **`branchId: null` alone is indistinguishable from "not supplied"** on a partial update, which is why
`clearBranch` exists. Pinned by `AnUpdateThatDoesNotMentionTheLocation_LeavesItAlone`.

‼️ **Only send anything when `locationField.visible` is true.** A form that never rendered the control must not
assert a choice — the server applies the 0/1/2+ rule itself, and an unknown id is refused with
`404 branch_not_found`.

### ‼️ L82 — every area mutation must evict the cache

`IBranchResolver.EvictAreaMap(businessId)` is called on **create, re-point and delete**. L82 always required it
on "any branch OR service-area mutation", but only the branch half shipped in Phase 6 — so a re-pointed area
kept routing new work to its OLD location for up to the 300-second TTL, silently, and only for the business that
had just reorganised itself. Eviction on UPDATE is conditional on the branch actually changing, so a rename or a
radius edit does not throw the map away for nothing.

### ‼️ A SQL outage must never fail this Cosmos write

The location lookup is the ONLY SQL on this path and it is a routing HINT. `ResolveBranchAsync` catches, logs at
Warning and **degrades to `null` (the whole business)** — which is always valid and always visible. An earlier
version made it a hard dependency and answered the provider
`400 "The ConnectionString property has not been initialized"` on a Cosmos write, which is exactly the failure
**L94** was locked to prevent. Falling back to null is also the SAFE answer for a client-supplied id: unverified
it could name another tenant's branch, and storing it would be a tenant-isolation hole — untagged cannot be.

### The one entry point to Locations

BR-2: the Locations screen is reachable at zero locations but **UNADVERTISED** — no sidebar or menu entry at any
count. The only link is a footer line on the Service Areas surface (web `ServiceArea.jsx`, mobile
`EditManageServiceArea`), gated on `can("team.read")` so it never lands on a denied screen, and its copy asks
the QUESTION without naming the noun — *"Do you work from more than one place?"* — because at zero locations
the word must not appear anywhere.

### The area list

At 2+ locations each area row shows its location NAME beneath the area name. **Provider-typed, never
translated.** Absent below two, under the same `showsLocations` gate as everything else.
---

## ‼️ THE WIZARD RUNS OUTSIDE /dashboard — mind what its steps depend on (2026-08-07)

Wizard steps 2 (`ServiceArea`) and 5 (`SetAvailability`) are the SAME components the profile pages render, so
anything they consume must exist on BOTH routes. `useBusiness()` **throws** when its provider is missing, and
`BusinessProvider` used to be mounted only in `app/dashboard/layout.jsx` — so pressing **Next** on step 1 killed
the page with a renderer crash, not the app error card.

- `BusinessProvider` now lives in **`app/layout.js` (the ROOT)**; `app/dashboard/layout.jsx` keeps `WorkspaceGate`
  only. Provider-mobile always did it this way (`App.tsx` wraps the whole navigator).
- ‼️ **Never gate wizard copy on `can(...)` without `access &&`** — `can()` answers false until `GetMyAccess`
  resolves, which told a provider setting up their own business that their hours were read-only.
- Guards: `src/context/businessProviderReachability.test.js` (import-graph walk, all routes) +
  `components/onboarding/add-business-information/onboardingTenancy.test.jsx` (renders steps 2 and 5).

Full detail, and the other five sites of the same defect, in the `clinqet-provider-teams` SKILL.

---

## ‼️ PHASE 16 (2026-08-09) — INCOMPLETE ⇒ REDIRECT ON SWITCH, AND THE PER-BUSINESS SKIP

### The step-order table lives in ONE place now

`onboardingResume(steps)` in the shared tenancy rendering rules
(`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js` and its provider-mobile twin) returns
`{ complete, stepsLeft, firstMissingStep }` from the wizard's own order:

```
details AND address -> 1 · serviceArea -> 2 · businessCategory -> 3 · services -> 4 · availability -> 5
```

`app/HomeClient.jsx` used to carry its own copy of that table and had it scrambled once (`!businessCategory`
→ `step=2`), which bounced the provider from Business Category back to Service Area. The root route, the
resume card, the switcher's "Setup incomplete" marker and provider mobile all read it from here, so
"where you left off" cannot mean two different steps on two screens. Parity-fixture covered.

‼️ **Portfolio is deliberately absent.** It is tracked step 6 and has no wizard tab, so counting it would
report a step left that nothing in the wizard can open.

### Switching into an unfinished business takes you to onboarding

The rule is mounted in the **dashboard LAYOUT**, not the root route: web
`components/tenancy/WorkspaceOnboardingRedirect.jsx` (headless) wraps `hooks/useWorkspaceOnboarding.js`. The
root route only runs on a cold entry, and a workspace SWITCH never re-enters it — so putting the rule there
would have covered the one journey that does not need it and missed the one that does.

- Escapable by design: an explicit skip for THAT business wins for the rest of the session.
- A FAILED profile read moves nobody and marks nothing — absence of data is never a statement about them.

### ONE skip button whose LABEL changes with context

`Onboarding.LaterCta` ("I'll do this later") when they hold another **enterable** business — it switches into
it and confirms with `Onboarding.NewBusiness.Saved` — and today's "Skip to dashboard" when this is their only
one. **Two buttons doing the same thing is itself the confusion.** On web the button also appears on step 1
when they hold another business, because the business they came from is waiting; a first-time provider on
step 1 still sees no skip, exactly as before.

‼️ **The skip key is PER BUSINESS** (`onboardingSkipped:{businessId}`) on both platforms. Provider mobile had
no skip memory at all before this phase — `lib/tenancy/onboardingSetupState.ts` adds it alongside the
"setup incomplete" record.

### The resume card, and why it is not shown earlier

`Onboarding.Resume.*` renders only after an explicit skip: before that the provider is taken to onboarding, so
a card offering what they are already looking at would be noise. ‼️ **i18next takes exactly ONE count per key**,
so the count PHRASE (`ONBOARDING.RESUME_STEPS_LEFT`) is its own key and the sentence composes it — mobile
forbids inline ICU (CP11).

### Reuse the EXISTING AI copy

`aiNudge.quickSetup.title` / `.body` / `AISetup.QuickSetupButton`. **Do not invent new AI wording** — the owner
was explicit about this.
