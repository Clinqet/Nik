# Phase 5 — profile writer + location preparer (handoff, 2026-10-07)

Built and compiling, NOT yet tested:
- `clinqetinfrastructure/Services/ProviderImport/ProviderImportLocationPreparer.cs` (P1, §8.5/§8.7): existing
  `IGeocodingService` only. Street confirmed only when not partial/coarse, in the file's country, with a street-level
  component; else `AddressNotConfirmed` + city fallback. Source point within `GeocodeAgreementStreetKm` kept, else the geocoded
  point + `AddressNotConfirmed` + note `MapPointDisagrees`. City-level ⇒ city centre (`GeocodeAgreementCityKm`). Province
  filled from the geocoder. Primary = first placeable address (source primary first); if none, the default service area stands
  in as a city-level primary (reading of F6g); nothing placeable ⇒ `Primary = null` (NoCity). Areas geocoded city-level,
  unplaceable ⇒ dropped + `ServiceAreaNotPlaced`; null radius ⇒ `Discovery:CountryDefaults` via `DiscoverySettings`.
  Geocoder outage ⇒ throws (item retried) — never recorded as NoCity.
- `clinqetinfrastructure/Services/ProviderImport/ProviderImportProfileWriter.cs` (S2 fields + S3): fill-blank profile fields
  (one `UpdateItemWithRetryAsync`), PUBLIC contacts only, a different existing value ⇒ `NotApplied AlreadyHasValue`;
  deterministic `AddressId = DeterministicGuid(businessId,"import-address", NameKey(city)|NameKey(street))`; city-level ⇒
  `Street = ""`, `ZipCode = ""`; areas written by the writer (prepared centre + radius, `ProviderSetupAreaMatcher`, seed
  `provider-setup-service-area`); category selections via `AddSubcategorySelectionAsync`; services/offers/hours through
  `IProviderSetupApplier` with the §19.1 import options, `FileUrl = "provider-import"`, `ServiceFacts` with
  `DeterministicGuid(businessId,"import-service",SourceNameKey)`; §8.5.7a at-store without street; hours only when known;
  FAQs `CreateFaqIfAbsentAsync` id `DeterministicGuid(businessId,"import-faq", KnowledgeText.Normalize(q).ToLower())`;
  licences create-only id `DeterministicGuid(businessId,"import-license",type,number)`. Verdict flags read the business's
  state so a redelivery decides the same.
- Registered in `ProviderImportServiceRegistration.AddProviderImportWorker` (verifier singleton; preparer + writer Scoped).
- New `ProviderImportNoteCode` values: `AddressNotPlaced`, `ServiceAreaNotPlaced`, `MapPointDisagrees`.

NOT done:
1. Unit tests (Functions `Clinqet.Communications.UnitTests/ProviderImport/`, Moq, a capturing `IProviderSetupApplier` mock):
   preparer AD3/AD6/AD7/AD8/AD10, default radius, outage throws, next-address promotion, area standing in; writer: every
   mapping rule, fill-blank + NotApplied (R2/R3/R6), deterministic ids, rerun converges, hours never defaulted/overwritten
   (H1), city-level address, public vs owner contact (X29), AtStoreWithoutStreet, NoApprovedServices, PriceAboveCeiling, the
   exact applier options. Sabotage ≥ 3.
2. Integration: `WriteAsync` twice (then with LESS data) on the real Cosmos emulator via `FunctionAppFactory`
   (`Clinqet.Communications.IntegrationTests`) — every document's `_etag` unchanged on the rerun. The factory needs
   `IServiceAreaRepository`, `ISelectedCategoryRepository`, `IAvailabilityRepository` registered.
3. Functions DI: `AddProviderImportWorker` not yet called from `Program.cs`; `IProviderSetupApplier` and
   `IKnowledgeManagementService` (and their dependencies) not registered in the Functions host (T-4/T-5 DI audit).
4. Functions `appsettings.json` lacks `Discovery:CountryDefaults` ⇒ the default radius falls back to 50 km (India should be 25).
5. Decisions to revisit: offers with a MinimumSpend are NOT imported (the applier's `ExtractedOfferDto` has no minimum — ask
   before widening the shared DTO); not done deliberately: `TimezoneMismatch` (no reason code), area history, branch/currency
   cache eviction, marketing address update.
