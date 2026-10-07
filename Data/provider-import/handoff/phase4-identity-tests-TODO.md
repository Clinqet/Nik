# Phase 4 — Identity tests still to write (handoff, 2026-10-07)

Home: `clinqetidentity/Clinqet.Identity.IntegrationTests/Tests/ProviderImport/` (new folder). Identity's `Program.cs` is the
only host that registers `ProviderTakeoverService` and the internal controller (§0.18).

## Suspected defect — FIXED (2026-10-07)
See the race fix in `NEXT-SESSION-PROMPT-2.md` §3a. The race class is written; still write the rest below.

## Fixture facts
- `IdentityApiFactory` (assembly fixture): real SQL + Cosmos emulator + Azurite. The emulator has only `SystemData` and
  `UserMetadata`; create `ProviderData` (pk `/businessId`) from the test class with
  `CosmosContainerPolicies.ProviderData("ProviderData")` + `CreateContainerIfNotExistsAsync` on database
  `ClinqetIdentityTest`. Do not edit the factory.
- API key in the fixture: `integration-test-provider-import-internal-key-0001`. `API:RequiredHeaders:0 = User-Agent` ⇒ no
  User-Agent = 400 (`RequiredHeadersMiddleware`). Missing/wrong `X-Internal-Api-Key` = 401 (`ProviderImportApiKeyFilter`).
  Key < 32 chars fails `ValidateOnStart`: `factory.WithWebHostBuilder(… ProviderImportInternal:ApiKey=short …)` and assert
  `CreateClient()` throws.
- Rate limiter `provider-import-internal`: ONE fixed-window partition for every caller, 60/min, 429 + `Retry-After`. Run the
  functional tests on a derived host with `ProviderImportInternal:RateLimitPerMinute` high (parallel tests would otherwise
  flake); the 429 test on its own derived host with the limit 2. A derived host has its own singleton
  `MockServiceBusService` / `MockEmailService` / `MockSmsService` / `MockPushNotificationService`; still filter by
  userId/businessId. Patterns: `Tests/HealthEndpointTierIntegrationTests.cs`, `Tests/AdminAlertRepositoryRegistrationTests.cs`.
- Offer-match: `OfferMatchEnqueuer` sends `SubscriptionChargeMessage` (`Kind = OfferMatchKind`) to
  `SubscriptionChargesQueueName`; assert none for an imported business (sabotage: flip `enqueueOfferMatch: false` in
  `CreatePreparedBusinessAsync`).
- Outcomes come from `AdminProviderProvisioningService.Import.cs` (`ClassifyHolder`, `ValidateImportRequest`). The SQL
  `Business` on Created: `Status = Active`, `DisplayName = businessName`, `SignupOrigin = Business`, primary-owner membership;
  `businessId` is allocator-made (NOT deterministic); only `userId` is deterministic. Identity writes no Cosmos profile.
  User: `ProvisionedAt` + `ProvisionedByAdminId` set, no `PasswordHash`, `ReceiveMarketingEmails = false`.
- Friendly-name endpoint: 400 unless `IsBusinessWaitingForItsOwnerAsync(businessId)` AND
  `GetOwnedBusinessIdAsync(userId) == businessId`. `FriendlyNameService.TrySetAsync` skips invalid/reserved/wrong-length/
  taken; a second call ⇒ `AlreadyHeld = true`, same slug; never sends `FriendlyNameUpdated`. Existing coverage (do not
  duplicate): `Tests/Services/FriendlyNameServiceIntegrationTests.cs` (FN1, FN6).
- Take-over: `ProviderTakeoverService.TakeOverAsync` → `LiftImportHoldAsync` → `ImportedProfileActivation.ActivateAsync`.
  Pending ⇒ Active; Active/Inactive/Suspended/missing ⇒ no alert; Conflict (ETag fails 3×) or exception ⇒
  `ProviderImportActivationFailed`, High, `EventId = DeterministicGuid.Create("provimport-activation-failed", businessId)`,
  `forceAdminAlert: true`; the take-over still returns `TakenOver`; a second take-over returns `AlreadyTakenOver`, no second
  alert. Simulate with a decorating `IBusinessProfileRepository` whose `TrySetLifecycleStatusAsync` returns false/throws,
  service built by hand on a real SQL `AppDbContext` (as `FriendlyNameServiceIntegrationTests.NewService`). References:
  `Tests/Services/ProviderTakeoverIntegrationTests.cs`, `Clinqet.Identity.UnitTests/Services/ProviderTakeoverAlertTests.cs`.

## Classes to write
1. `ProviderImportAccountsEndpointIntegrationTests`: Created; AlreadyCreated/X2; ExistingPrepared (C15/X3/X4/C17);
   ExistingTakenOver (C12/C16); ExistingSelfRegistered (C14); ExistingClosed (C27/X36); ContactOnTwoAccounts (C13);
   PendingInvitation (X7); CustomerRecord (X8); InvalidRequest (400 naming the field); OwnershipLimit; key/boot (401, 401,
   400, boot fails); 429 + Retry-After; race same contact different userIds ⇒ one account + ExistingPrepared; (same-userId race DONE in
   `ProviderImportAccountRaceIntegrationTests`); nothing sent (offer-match, notification, email, SMS).
2. `ProviderImportFriendlyNameEndpointIntegrationTests`: FN1, FN2, FN4, AlreadyHeld same slug, not this user's prepared
   business ⇒ 400, no `FriendlyNameUpdated`.
3. `ProviderImportTakeoverHoldLiftIntegrationTests`: X22, X23, non-Pending untouched.
Sabotage ≥ 3 (copy to scratchpad, mutate, see it fail, copy back, `diff`). Run only these classes; report exact counts.
