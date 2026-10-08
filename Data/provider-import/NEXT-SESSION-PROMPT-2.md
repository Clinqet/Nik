# Provider Import — continue the build (session 2 hand-over, written 2026-10-07)

Copy everything below the line into a new session.

---

## ‼️‼️ READ FIRST — THREE THINGS THAT MUST NEVER BE MISSED ‼️‼️

**N-1. The provider import's Functions entry points are PARKED and MUST be put back.**
`Data/provider-import/handoff/ProviderImportFunctions.cs.txt` holds the three triggers of the import:
`ProviderImportValidate` (queue `provider-import-validate`), `ProviderImportItem` (queue `provider-import-items`) and
`ProviderImportSweeper` (timer `%AdminProviderImport:Processing:SweeperSchedule%`). They were taken OUT of
`clinqetfuncations/Clinqet.Communications/Functions/` on purpose, because the services they call are not yet registered in
the Functions host and the photo copier does not exist yet. A deployed host with the triggers in place but the services missing
would fail every 15 minutes. **Until the file is moved back, the import cannot run at all.** Put it back only after ALL of:
1. `IProviderImportPhotoCopier` is implemented (§5.1 step 1).
2. `AddProviderImportWorker` + every import service is registered in Functions `Program.cs` AND in `FunctionAppFactory`
   (§5.1 step 2), and `Discovery:CountryDefaults` is in Functions appsettings.
3. The host's DI validation test passes (the host boots with every import service resolvable).
Then: move it to `clinqetfuncations/Clinqet.Communications/Functions/ProviderImportFunctions.cs` (rename `.cs.txt` → `.cs`),
build, run an end-to-end Functions integration test through the triggers, and delete it from `handoff/`. **The programme is
NOT done while that file is still in `handoff/`** — the §27 audit must check it.

**N-2. Decided — the provider name prompt's "Not now" snoozes it on web AND phone (FINAL, owner 2026-10-07).**
The latest `ProviderNamePrompt` dismissal from EITHER surface counts, for `NamePrompt:SnoozeDays` (7). One person, one
account: being asked again on the other device minutes later is a worse experience. Do not change this; keep it covered by
tests on both apps.

**N-3. Admin import values that are SETTINGS now (not constants) — keep them settings.**
In `clinqetshared/Models/AdminProviderImportSettings.cs` and the Main API `appsettings.json` node `AdminProviderImport`:
`Storage:ReadLinkMinutes` = 5 (how long the admin's links to one provider's source/result files work — §22),
`Limits:MaxBulkApprove` = 200 (most providers one bulk Approve may take), `Limits:DefaultRunsPageSize` = 20 (imports list
page). The runs scan uses `Limits:MaxItemsPageSize`. Class defaults equal appsettings; the Functions host does not read
them, so they are NOT in Functions appsettings (CLAUDE §4). Any NEW limit, lifetime or page size follows the same rule
(CLAUDE §0.12): a setting with a class default equal to appsettings — never a constant.


Continue building the **Provider Import programme** for Clinket. The previous session built Phases 2–4, most of Phase 5,
Phase 6 code, Phase 7 and most of Phase 9, then stopped for a clean hand-over. **Everything is on `master` in every repo**
(rebased onto the latest `origin/master` and pushed as a fast-forward on 2026-10-07; linear history, clean trees). Start every
repo from `origin/master` (`git fetch origin && git checkout -B <your branch> origin/master`, or work on `master` itself if the
owner says so). Never create a merge commit (CLAUDE.md §0.21): `git fetch` + `git rebase origin/master`, and prove
`git rev-list --merges origin/master..HEAD` prints nothing before every push.

## 0. Where things are
- In a cloud session every repo is at `/home/user/<repo>`. The owner's `C:\Nik\<repo>` is the same repo. `C:\Nik\Data\...`
  is the **`Nik` repo's** `Data/` folder (`/home/user/Nik/Data/...`).
- Repos involved:
  - `clinqetshared`, `clinqetcore`, `clinqetinfrastructure`: libraries every host compiles in.
  - `clinqetapi`: Main API.
  - `clinqetidentity`: Identity API.
  - `clinqetfuncations`: Functions host `Clinqet.Communications`; the folder name is misspelt on purpose.
  - `cosmosindexsetup`
  - `azureautomation`: ARM + `deploy.ps1`.
  - `clinqetwebadmin`: admin web.
  - `clinqetwebpartnerapp`: provider web.
  - `clinqetwebuserapp`: customer web.
  - `clinqetmobilepartnerapp`: provider phone.
  - `clinqetmobileuserapp`: customer phone.
  - `Nik`: CLAUDE.md, skills, Data.
- .NET: `export PATH=/opt/dotnet:$PATH DOTNET_ROOT=/opt/dotnet`. Docker is available, so Testcontainers integration tests
  run (start `dockerd` if `docker info` fails). Builds are slow (a test project takes ~5 min), so run **targeted** test
  filters while working and each FULL suite **once** at the end of a phase. The owner explicitly asked not to re-run full
  suites repeatedly.
- Scratch files go only in the session scratchpad. Never `git checkout --`/`restore`/`reset`/`stash`/`clean`
  (§0.19). Do a sabotage check by copying the file to the scratchpad, mutating it, then copying it back and `diff`ing.

## 1. The project in one paragraph
Clinket is a two-sided local-services marketplace.
- **Input.** Bots scrape public data on local businesses into one JSON file per batch (schema 2.0:
  `Data/provider-import/provider-import.schema.json`; `provider-import.example.json` validates).
- **Check file.** An admin uploads the file on a new admin page, "Provider import". The system checks it against the
  schema: it keeps only what the schema defines, ignores unknown fields, prunes broken optional values, and skips only
  providers whose required parts are broken. It then cleans every value in code, merges records that are clearly one
  business, skips conflicting duplicates, matches against existing Clinket accounts, and shows a plan with a cost estimate.
- **Start import.** A Functions worker processes providers one at a time per lane (Service Bus, chained lanes):
  1. geocode;
  2. ONE AI curation call per provider, on a DEDICATED AI settings node and deployments, banked by input hash + rules version;
  3. verify every AI answer in code — nothing invented;
  4. a second opinion only when needed;
  5. take every skip decision BEFORE any account exists;
  6. call a private Identity endpoint to create the prepared (passwordless) account and its business, with deterministic ids;
  7. build the profile hidden (`BusinessProfileStatus.Pending`) through the SHARED apply half of the AI provider setup;
  8. set a web name;
  9. publish it (silent Pending → Active) or hold it for admin review with plain reasons.
- **Rules.** One summary alert per run; the provider web/app per-event alerts are unchanged. A re-upload with MORE
  information fills gaps; with LESS it NEVER deletes anything.
- **Same programme, also:**
  - removes `UserProfile.IsAdminProvisioned`;
  - fixes "Guest User" names after a take-over (N1–N5);
  - stops inventing default opening hours (owner decision A: "Hours not listed").

## 2. The authority — read these FIRST, fully
1. **`/home/user/Nik/Data/provider-import/SOLUTION.md`** — the design. It contains:
   - §2 owner decisions D1–D21;
   - §3 verified code facts;
   - §5–§19 rules, including:
     - §7 check file;
     - §8 cleaning;
     - §9 AI;
     - §10 verdict/review;
     - §11 processing stages P1–P5 / S1–S6, lanes, failures, sweeper;
     - §11A Identity endpoint;
     - §12 re-uploads;
     - §15 storage;
     - §16 queues/alerts/limits;
     - §17 settings;
     - §18 admin web;
     - §19 refactors;
   - §20 pilot;
   - §21 the edge-case catalogue (every row needs a test; test names carry the row IDs);
   - §25 build order;
   - §26 skills/memory;
   - **§27 the MANDATORY multidimensional audit**.
2. **`/home/user/Nik/Data/provider-import/BUILD-LOG.md`** — what was found and decided while building:
   - §1 pre-existing defects;
   - §2/§2a before/after test runs;
   - §3 the V-1/V-2 sweeps and fixes;
   - owner decisions of 2026-10-07 (see §3 below);
   - §5 refactor design;
   - §6 traps;
   - §7 mockup;
   - §8 Phase 2;
   - §9 R-4..R-10 Phase 4–5 design;
   - §10 R-11..R-18 orchestration decisions.
3. **`/home/user/Nik/Data/provider-import/handoff/*.md`** — one file per unfinished area. Exact file paths, what is done with
   test counts, and what is not done. **Work from these lists.** Also in that folder:
   `ProviderImportFunctions.cs.txt`, the parked Functions entry points (see §5.1).
4. The original programme prompt: `/home/user/Nik/Data/provider-import/NEXT-SESSION-PROMPT.md` (objectives, standing orders).
5. `/home/user/Nik/CLAUDE.md` — every rule is binding. Most relevant:
   - §0.6 no cross-partition Cosmos queries;
   - §0.7 no schema change beyond SOLUTION §15.1 without asking with the table;
   - §0.8 unit + real-engine integration tests;
   - §0.14 terse comments;
   - §0.16 clean tree;
   - §0.17/§0.18 test placement;
   - §0.19 no checkout/restore;
   - §0.21 linear history;
   - §0.23 bank rules versions.
6. Skills to read: `clinqet-prepared-providers`, `clinqet-ai-assistant`, `clinqet-provider-onboarding`,
   `clinqet-service-listing`, `clinqet-function-app`, `clinqet-deployment`, `clinqet-admin-app`, `clinqet-identity-api`,
   `clinqet-cosmos-data`, `clinqet-search-discovery`, `clinqet-testing`, `clinqet-notifications`, `clinqet-auth-sessions`.
   They are in `/home/user/Nik/.claude/skills/`. Note: `.github/skills` and `.cursor/rules` do NOT exist in the Nik checkout;
   update the copies that exist and say so.

## 3. Owner decisions made in the previous session (binding)
- **Hours — decision A, approved: "follow best practice, do not over-complicate".**
  - No default hours are ever stored for any business.
  - Editors (provider web/phone, admin wizard) suggest 9–5 labelled "Suggested" and store only on Save.
  - Customers see "Hours not listed", never "Closed".
  - The search index stores null (unknown) per day when a business has no rows; the day filter is unchanged (`eq true`).
  - Existing data is left alone. AI setup saves only the days it read.
- **B1:** an FAQ an admin deleted on an UNCLAIMED business comes back if a later upload carries it.
- **B2:** the admin apps' hours notice is English.
- **Name prompt "Not now":** snoozes web AND phone (N-2) — final.
- **Minimum-spend offers:** imported (done, §3a).
- **Mockups:** admin mockup gate waived. The provider name prompt mockup (`Data/mockups/provider-name-prompt`) is registered;
  the owner waived waiting for approval.
- **Process:** do not stop; ask only when genuinely unsure (never assume). Quality over speed. Modern, responsive design in
  the house theme.
- **Sandbox keys:** the sandbox keys in tracked appsettings are ACCEPTED. Do not report or rotate them.

## 3a. Closed at hand-over (2026-10-07, after the owner's review)
- **Same-request race (X2) — FIXED + proven on real SQL.** Two defects, both reproduced first by
  `clinqetidentity/Clinqet.Identity.IntegrationTests/Tests/ProviderImport/ProviderImportAccountRaceIntegrationTests.cs`
  (2 tests, failed with `PK_UserProfile` violation before the fix, pass 3 runs in a row after):
  1. `AdminProviderProvisioningService.TryInsertPreparedUserAsync` now treats a clash on the account's OWN id as a lost race
     (the import's deterministic id losing to its own redelivery) instead of rethrowing a 500.
  2. `AdminProviderProvisioningService.Import.cs` `EnsureImportedBusinessAsync`: when business creation answers "ownership
     limit" because a concurrent copy of the same request created the business a moment earlier, it re-reads the account's
     business and returns it (was: `OwnershipLimit` to every losing copy).
  Regression: Identity unit `Provision|ProviderImport` 67/67, integration `Provision|ProviderImport|AdminProvider` 48/48.
- **Offers with a minimum spend — DONE (owner: "yes, we need that").** `ExtractedOfferDto.MinValue` (DTO only; the stored
  `Offer.MinValue` already existed — no schema change). `ProviderSetupApplier.SaveExtractedOffersAsync` stores it, refuses an
  offer whose minimum is ≤ 0 (never drops the minimum), and adds `|min:` to the dedupe signature ONLY when a minimum exists
  (so every existing offer keeps its signature and id). The import writer passes `NormalizedOffer.MinimumSpend`. Tests in
  `McpServiceTests` (minimum kept / invalid refused / two minimums = two offers); sabotage-checked (removing the
  assignment fails both). API unit `McpServiceTests|ProviderSetup|Offer` 922/922.
- **Admin constants → settings (CLAUDE §0.12).** `AdminProviderImport:Storage:ReadLinkMinutes` (5),
  `Limits:MaxBulkApprove` (200), `Limits:DefaultRunsPageSize` (20); the runs scan uses `Limits:MaxItemsPageSize`. API
  appsettings only (the Functions host does not read them). Class defaults = appsettings. API unit ProviderImport 309/309.

## 4. Done so far (committed)
| Phase | State |
|---|---|
| 0 Research + notes | done (BUILD-LOG) |
| 2 Shared enums/settings, `PersonName`, `IsAdminProvisioned` removal + migration, PUT UserProfile marketing bug | done. ‼️ Confirm the migration is APPLIED to CA + IN: `cd cosmosindexsetup && dotnet run -- --all-regions --sql-only`, then `dotnet ef migrations list` for CA + IN (needs the owner's environment; if not possible here, list it in the final report) |
| 3 Refactors §19 (`IProviderSetupApplier` + options, `IBusinessProfileBootstrapService`, AlertMode/collector, silent `ActivateImportedAsync`, reactivate narrowing, `CreateFaqIfAbsentAsync`) | done, zero-regression proof recorded (API unit 16,411 pass; Identity integration 660) |
| 3b City-level address readers (A-1..A-6) + no-hours readers (H-1..H-5) + decision A (UI + backend: no seeded hours, `Availability.IsConfigured`, search `bool?` per day) | done |
| 4 Identity: provisioning core (`ImportProviderAccountAsync`), internal endpoint `api/v1/internal/provider-import/accounts` + `/friendly-name` (API-key filter, rate limit), `FriendlyNameService.TrySetAsync`, N1/N2/N4/N5 server, take-over lifts Pending (`LiftImportHoldAsync` + High `ProviderImportActivationFailed`), `PhoneNumberNormalizer.ParseForRegion` | code done + unit tests. **Integration tests for the endpoint + take-over NOT written** → `handoff/phase4-identity-tests-TODO.md`. Names follow-ups → `handoff/phase4-names-TODO.md` |
| 5 Functions worker | partly — see §5 |
| 6 Main API admin controller + trust-page approve | code + unit tests (187 pass). Integration tests, sabotage, full suite → `handoff/phase6-admin-api-TODO.md` |
| 7 Infra (ARM queues/container, model deployments `gpt-6-luna-import`/`gpt-6.1-sol-import`, Key Vault `ProviderImportInternalApiKey`, deploy.ps1 settings, local.settings ×3) | done |
| 9 N3 name prompt (provider web + phone), N2 UI greetings, N4 clients, snoozable dismissal, `ClaimedAt` on the profile DTO, `NamePrompt:SnoozeDays` | mostly. Customer phone N4 + greeting, provider phone N4 tests, integration runs, viewport checks → `handoff/phase9-ui-TODO.md` |
| 8, 10, 11, 12 | not started |

## 5. Phase 5 (the ongoing phase) — exact state

### Built AND tested
- **File validator (§7.2 validate-then-prune):** JsonSchema.Net 9.4.0, 39 tests, 5,000 providers in ~2.5 s.
  - `IProviderImportFileValidator`, `ProviderImportFileValidator`, `ProviderImportSchemaModel`, `ProviderImportValidationResult`;
  - schema embedded in `Clinqet.Communications/Resources/ProviderImport/`.
  - Not handled: F3 (the stamp's served countries) is left to the caller — see §5.3.
- **Cleaner / skip rules / in-file merge (§8, §7.4, §7.5):** 188 tests.
  - `NormalizedProvider`, `ImportTextRules`, `ProviderRecordNormalizer`, `ProviderImportSkipRules`, `ProviderImportDeduplicator`, `ProviderImportMerger`.
  - Sabotage not done → `handoff/phase5-normalizer-TODO.md`.
- **AI curation + verification + bank (§9):** 396 tests under `ProviderImport|BankRulesVersion`; bank pin `(1, "64f4a480857ce7ee")`.
  - In `Services/ProviderImport/Ai/`: `CurationAnswer`, `CurationPrompt`, `ProviderImportCurator`, `CurationVerifier`.
  - System prompts in Functions appsettings equal the class defaults.
  - Sabotage + DI registration still to do → `handoff/phase5-ai-curation-TODO.md`.

### Built and compiling, NOT yet tested
- **Location preparer (P1) + profile writer (S2/S3):** `ProviderImportLocationPreparer`, `ProviderImportProfileWriter` →
  `handoff/phase5-writer-preparer-TODO.md`.
- **Orchestration (Functions host, `Clinqet.Communications/Services/ProviderImport/`):** tests → `handoff/phase5-orchestration-tests-TODO.md`.
  - `ProviderImportValidationRunner` (§7.2 steps 1–9, plan, lanes, counters);
  - `ProviderImportItemProcessor` (claim, P1–P5, S1–S6, verdict, finish, pause, `Reconcile` for the second opinion);
  - `ProviderImportItemAiMeter` (§16.6 limits + warnings);
  - `ProviderImportLaneAdvancer` (send-then-complete chain, finish + recompute + summary alerts + slot release);
  - `ProviderImportSweeper` (§11.7);
  - `ProviderImportAlerts`.
- **Also built:**
  - `ProviderImportExistingMatcher` (§12.1/12.2);
  - `ProviderImportIdentityClient` (status mapping + transient retry; test file `ProviderImportIdentityClientTests.cs` exists — run it);
  - `FriendlyNameCandidates` (§11.5);
  - repositories `ProviderImportRunRepository` / `ProviderImportItemRepository`;
  - `ProviderImportBlobStore`;
  - `ProviderImportRunSlots` / `ProviderImportStatuses`;
  - `ProviderImportStageContracts.cs` (preparer, writer, photo-copier interfaces);
  - `AddProviderImportWorker` registration (partial).
- **Fixed at hand-over:** the item repository point-reads/patches now map the item KEY to the document id
  (`ProviderImportKeys.ItemId(runId, itemKey)`); `item.ItemId` is the 16-hex key. Prove it with the repository integration
  test (Phase 6 TODO 1) and check every fake/test agrees.

### 5.1 NOT done in Phase 5 — do in this order
1. **Photos S5 (§11.6):**
   - Add `IngestPublicMediaAsync(url, target)` to the EXISTING `RemoteImageIngestionService`, reusing every guard (https,
     public DNS re-checked at connect, no redirects, MIME + magic bytes, streaming size cap, max pixels). Use the PublicHost
     policy with NO extension requirement, writing to the PUBLIC media containers already used for service images,
     portfolio and profile pictures.
   - Derivatives go through the existing media-derivative queue. Image ids are deterministic:
     `DeterministicGuid(businessId, "import-image", sha256(url))`.
   - Implement `IProviderImportPhotoCopier`, mapping each source field to its target:
     - `media.logoUrl` → profile picture, only when unset;
     - `services[].imageUrls[0]` → that service (the service id is `DeterministicGuid(businessId,"import-service",SourceNameKey)`);
     - `portfolio[]` → projects;
     - `media.galleryImageUrls` → the global portfolio.
   - Caps come from §16.6. A failed image never fails the provider. No AI captions.
2. **Host wiring (§16.2 DI audit, traps T-4/T-5):**
   - Call `AddProviderImportWorker` from Functions `Program.cs` AND `FunctionAppFactory`.
   - Register: `ProviderImportCurator`, `ProviderRecordNormalizer`, `ProviderImportDeduplicator`, `IProviderImportFileValidator`,
     `IProviderImportExistingMatcher`, `IProviderImportAccountStore`, the photo copier, and the Functions services
     (`ProviderImportValidationRunner`, `ProviderImportItemProcessor`, `ProviderImportLaneAdvancer`, `ProviderImportSweeper`,
     `ProviderImportAlerts`).
   - Make sure the host has `IProviderSetupApplier` and ALL its dependencies, `IKnowledgeManagementService` (with
     `IReceptionistAvailability`, `IKnowledgeRefreshLimiter`), `IBusinessProfileBootstrapService`,
     `IProviderLifecycleService`, `ICategoryPromptService` (global categories only — `businessId: null`), `Discovery:CountryDefaults`
     in Functions appsettings (else India gets 50 km), `MaxAllowedPrice`, `CategoryAlert` settings.
   - Lifetimes: no singleton capturing a scoped dependency (`ValidateScopes`).
   - Then move `handoff/ProviderImportFunctions.cs.txt` back to `clinqetfuncations/Clinqet.Communications/Functions/ProviderImportFunctions.cs`.
     It was parked so a deployed host never runs triggers whose services are unregistered.
   - Prove the host boots: run the Functions integration factory's DI validation test.
3. **Tests for everything in "built, not tested"** — exact lists in `handoff/phase5-orchestration-tests-TODO.md` and
   `handoff/phase5-writer-preparer-TODO.md`.
   - Unit with fakes honouring ETags.
   - **Real-engine integration** (Cosmos emulator + SQL + Azurite via `FunctionAppFactory` in `Clinqet.Communications.IntegrationTests`):
     - validate → plan → start → process one provider end to end with the AI and Identity mocked at the HTTP boundary;
     - a redelivery at every checkpoint converges (no second account/service/FAQ/area/alert);
     - the writer twice (and with LESS data) leaves every document's `_etag` unchanged;
     - the finish race;
     - the sweeper.
   - Sabotage every guard.
4. **Known open items in the code:**
   - **F3:** a file whose `batch.countryCode` this stamp does not serve must fail the envelope. Find how a stamp declares
     its served countries; ASK if none exists.
   - Two CS8601 warnings in `ProviderImportProfileWriter.cs` (~L487-490).
   - `TimezoneMismatch` (§8.5.8) has no reason/note code. Decide with the owner or record it in the log.
   - `ProviderImportItemProcessor.Reconcile` is `internal static`, and Communications has no `InternalsVisibleTo` for its tests.
   - Check that the AI-outage rule R-11 (BUILD-LOG §10) stays below the queue's maxDeliveryCount 5.
   - `AiModelPinConventionTests` registry for the import deployments.
5. **Skills + memory for Phase 5.**

### 5.1a Integration-test flake risk found at hand-over (not provider-import code, fix in this programme's test pass)
- FIXED: `clinqetapi/Clinqet.API.IntegrationTests/Repositories/KnowledgeRefreshCounterCosmosIntegrationTests.cs`
  `TwentySimultaneousReservations_LoseNothing_AndCountEachDocument` failed only under the full suite with
  `HttpRequestException: The response ended prematurely` (the Cosmos emulator dropping a connection under load — NOT a counter
  bug; the class passes alone every time). Now each reservation counts against its own document, a cut-off reservation is
  resolved by ONE read (present ⇒ landed, absent ⇒ re-sent) via `TransientCosmos.AnsweredAsync`, and the assertions stay exact
  (day total = 20 = sum of documents, every document exactly 1). Sabotage-checked (lost updates ⇒ fails).
- STILL EXPOSED to the same emulator drop (not failing yet): `ProviderSetupUsageCounterCosmosIntegrationTests.TwentySimultaneousIncrements_LoseNothing`
  (one shared number — a cut-off increment cannot be attributed by a read; design an exact resolution, e.g. sequential
  ambiguity resolution or per-request markers, and never weaken `Equal(20)`) and `CosmosTenancyIntegrationTests` (~L415, its
  `Delivered` helper re-sends after a transport failure, which can over-count to 21). Fix both the same honest way and
  sabotage-check them.

### 5.1b CI notes from the hand-over (2026-10-08)
- FIXED: Identity `LocalizationSourceConventionTests` — `ProviderImportInternalController` used English literals; it now uses
  `ILocalizationService` keys `ProviderImport_RequestBodyRequired`, `ProviderImport_InvalidField`,
  `ProviderImport_FriendlyNameRequestInvalid`, `ProviderImport_NotAPreparedBusiness` (all 5 languages), and the candidate cap is
  the setting `ProviderImportInternal:MaxFriendlyNameCandidates` (20). Bug closed with it: the worker could send MORE candidates
  than Identity accepts (bot suggestions + 3 AI + up to 10 slugs) ⇒ every such provider Failed; the worker now caps at
  `AdminProviderImport:Identity:MaxFriendlyNameCandidates` (20). ‼️ The two settings must stay equal — add the check to
  `azureautomation/deploy.ps1` (the cross-host place, CLAUDE §0.17) in this programme. Unit tests:
  `Clinqet.Identity.UnitTests/ProviderImport/ProviderImportInternalControllerTests.cs` (5).
- FIXED: API `MarketplaceParticipationSeedSiteConventionTests` — the import built `new BusinessProfile` in the Functions
  processor; it now uses `BusinessProfileBootstrapService.NewShell` (registered with its reason: `CreateAsync` seeds the flag from
  SQL SignupOrigin). ‼️ Guard blind spot to close: the scanner only sees `new BusinessProfile {`, never target-typed
  `BusinessProfile x = new() {…}` — extend it (or ban target-typed creation of BusinessProfile) and prove it with a sabotage.
- FIXED: API `MoneyNeverFormattedFromTheReadersCultureTests` — the offer signature formatted the minimum with `F2`; it is a key,
  not money on a screen, and `F2` could collapse two minimums — now the exact round-trip `R`.
- NOT CODE: Functions `KnowledgeIngestSourceAnchorsIntegrationTests` failed because the SQL Server 2022 container crashed at
  startup on the CI runner (`RETAIL ASSERT ... qpcFrequency >= MinimumQpcFrequency ... DrtlpInitializeUserSharedData`) — the
  engine rejecting the runner VM's clock before any test code ran; the same image passes in the API/Identity suites and here.
  Re-run the job. If it recurs on that runner, look at the runner image/clocksource or the SQL image version — never add a blind
  retry in the fixture.

### 5.1c Fixed 2026-10-08 — a real bug the Identity integration test caught
`UserMetadataControllerIntegrationTests.DismissSpotlight_NamePromptAgain_MovesDismissedAtInSql` failed in CI and here: the
provider name prompt's SECOND "Not now" was silently lost, so the prompt would return on the next visit instead of after 7 days.
Root cause: `clinqetinfrastructure/Services/Auth/UserMetadataService.cs` `DismissSpotlightAsync` loaded the row to update without
`.AsTracking()`, and the Identity host registers `QueryTrackingBehavior.NoTracking` (`clinqetidentity/Clinqet.Identity.API/Program.cs`
~L546), so `SaveChangesAsync` wrote nothing. Fixed with `.AsTracking()`; the class passes 25/25 on real SQL (it failed before the
fix — that IS the sabotage proof). The unit test could not see it because EF InMemory tracks by default.
‼️ RULE FOR ALL NEW CODE (add it to the identity-api + infrastructure skills): any code that runs in the Identity host and changes
an entity it loaded MUST load it with `.AsTracking()` (or use `ExecuteUpdateAsync` / an explicit `Update`), and MUST have a
real-SQL integration test — an InMemory unit test cannot catch this. The §27 audit must grep every mutation reachable from the
Identity host for this.

### 5.2 Other phases left
- **Phase 4:** `handoff/phase4-identity-tests-TODO.md` (integration tests; the same-userId race is already FIXED and tested — §3a) and
  `handoff/phase4-names-TODO.md` (full suite runs, "Account owner" label call sites, the GET friendlyname check onto the
  shared rules, skills).
- **Phase 6:** `handoff/phase6-admin-api-TODO.md`.
- **Phase 8 — admin web (`clinqetwebadmin`, SOLUTION §18):**
  - nav;
  - runs list `/provider-imports`;
  - new import `/provider-imports/new` (upload via the SAS link, check, plan panels "Fields we ignored" / "Values we dropped");
  - run page `/provider-imports/:runId` (counts with drill-down, items table with status filter + paging, item drawer with
    the source next to what was built, approve / bulk approve / retry / remove with typed-name confirm, cancel / resume /
    retry-failed / cost-limit / discard, CSV reports, polling every `PollSeconds`);
  - `ProviderTrustPage.jsx` Approve for a Pending business;
  - the 9 new `AdminAlertType` labels on the Alerts page;
  - admin phone `alertTypes.ts`;
  - the three `AdminPushSettings:PushableTypes` lists for the High types.
  - English (admin-internal). Modern, dense, responsive (320/375/768/1024/1440), built from the admin app's existing
    components and the `react-icons` set.
  - Tests + ESLint 0.
- **Phase 9:** `handoff/phase9-ui-TODO.md` (customer phone N4 + greeting, provider phone N4 tests, integration runs,
  viewport/simulator checks).
- **Phases 10–11:**
  - Pilot (§20) as far as the environment allows: run the pipeline on the example file and the Ontario sample with mocked
    or real sandbox AI, and record the cost/accuracy numbers in SOLUTION §20.
  - New skill `clinqet-provider-import` in every skill directory that exists, registered in the instruction files' skill
    tables (count 42 → 43).
  - Update the skills listed in SOLUTION §26.
  - Memory entry.
- **Phase 12 — the §27 MULTIDIMENSIONAL AUDIT. MANDATORY. The task is not complete without it.**
  1. Independent reviewers, one per dimension (the 15 dimensions in §27.2), audit everything.
  2. Fix EVERY finding, each with a test that fails without the fix.
  3. A reviewer who did not write the fix re-verifies EACH fix.
  4. Report with the §27.5 evidence: findings table, every suite's totals, before/after regression runs, pilot numbers,
     migration proof, clean `git status`, `git rev-list --merges` empty.

## 6. How to work
- First: read SOLUTION.md, BUILD-LOG.md and every `handoff/*.md`. `git log --oneline -15` in each repo to see the
  previous session's commits.
- Then, in order: Phase 5 §5.1 → Phase 4 TODOs → Phase 6 TODOs → Phase 8 → Phase 9 TODOs → 10–11 → 12.
- Parallel sub-agents are fine for independent pieces. Give each the exact files, the CLAUDE.md rules, "do not commit", and
  "on a build lock wait 20 s and retry; never edit another agent's in-progress file".
- Before each commit:
  - build every touched project;
  - run targeted tests;
  - delete scratch files;
  - commit per repo with clear messages ending in the session's attribution lines;
  - `git fetch origin` + `git rebase origin/master`; prove `git rev-list --merges origin/master..HEAD` is empty; push to the
    branch the session/owner names (and to `master` as a fast-forward only when the owner says so — never `--force` on master).
- Delete each `handoff/*.md` item as it is finished, and the folder when empty. Record every new decision in BUILD-LOG.md.
- Ask the owner only when genuinely unsure, with the §0.7 table for any schema question. Never assume.


## 7. The previous session's work on `master` (latest commits per repo, newest first — all pushed 2026-10-08)

**clinqetshared**
```
bc969bd Provider import: friendly-name candidate cap as settings on both sides
2593402 Offers carry a minimum spend; provider import admin limits as settings
ece4052 Provider import: settings, DTOs, messages, normalisation enums, name-prompt settings
6672ec0 Provider import: SetupAlertFamily for alerts the shared setup collects instead of sending
3d62d4c Provider import phase 2: shared enums, PersonName, IsAdminProvisioned removed
a0e4ed4 Quotes: a failed pause check is no longer configured as send-anyway
e13dcbc Locations: move the default safely, in one transaction
5208136 Service AI validation: photo check types, measured content prompt, drop per-approval alert
6429d93 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
1adf683 Voice call experience P1: delete the P10 action-guard settings, add goodbye phrase lists
```

**clinqetcore**
```
49c1051 Provider import: run/item entities, repository and friendly-name interfaces, member display name
05e2cba Availability.IsConfigured: response-only flag for days nobody saved (never stored)
0b1f7aa Provider import: shared setup seams - alert collector, resolver overload, prepared pricing, no-revive writes, FAQ create-if-absent, profile bootstrap, silent activation
82854f6 Provider import phase 2: shared enums, PersonName, IsAdminProvisioned removed
8b7ab98 Search: the service search can ask whether the live index can answer
cec54c3 Service AI validation: review router, verdict-unavailable, contact pre-check
a3b9084 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
279caf5 Voice call experience P1: call timeline stamps, hangup fence, P10 interface removal
ee14fe9 Fix the CI breaks the prepared-provider change caused
9efb447 Prepared provider accounts, take-over, and services with no price
```

**clinqetinfrastructure**
```
553fbda6 Name prompt: a second "Not now" is saved — load the row tracked on the NoTracking Identity host
decb3bae Provider import: internal endpoint messages as localization keys; profile shell factory owned by the bootstrap; exact minimum-spend key
c6d8dcbc Provider import: same-request account race returns AlreadyCreated; minimum-spend offers through the shared saver; admin limits from settings
14a8597f Provider import: validator, cleaner, merge, matcher, AI curation and checks, profile writer, admin service, Identity provisioning endpoint core, friendly-name service, greetings; decision A (no seeded hours)
96309df1 Provider import readers: PDF address lines without blank parts; receptionist and business search say when no hours are listed
0972215d Provider import: extract the setup apply half and profile bootstrap; import options (collected alerts, create-only services, R4 price fill, offers never widened, FAQ by question); budget dials for the import sub-flows
7a2ed1bc Provider import phase 2: shared enums, PersonName, IsAdminProvisioned removed
016c4945 Search: the empty-index probe is a count-only query
5b45f0e8 Search and quotes: an empty city stays empty, and a failed pause check writes no lead
23e9cf1a Locations: move the default safely, in one transaction
```

**clinqetapi**
```
1dd02fd2 Marketplace seed convention: register the bootstrap's profile shell factory
7eee5c32 Knowledge refresh counter race test: resolve a cut-off reservation by reading, never by guessing
cd99541b Tests for minimum-spend offers; provider import admin limits in appsettings
d8f64625 Provider import: admin import controller, trust-page approve, name-prompt snooze in app config; decision A bootstrap without hours
d98cefed Provider import readers: mark suggested hours in GET business/availability; tests for PDF address lines and the hours note
d6225da2 Provider import: controller uses the shared bootstrap, provider reactivate only from Inactive; pins for every setup default; collect-mode guard; fix order-dependent billing catalogue test
2087ebe6 Search: an empty live service index asks the customer to try again
99e5eb48 Locations: move the default safely, in one transaction
25bdfec2 Service AI validation: shared review rule, multi-type admin alerts, photo check flag
568742e9 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
```

**clinqetidentity**
```
363d151 Provider import internal endpoint: localized refusals, candidate cap from settings, controller tests
f16cb5a Provider import: real-SQL tests for the same-request account race
c696e80 Provider import: internal accounts and friendly-name endpoints, names after take-over (N1/N4/N5), ClaimedAt on profile
c2262ef Provider import phase 2: shared enums, PersonName, IsAdminProvisioned removed
72f896e Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
1f3becc Fix the CI breaks the prepared-provider change caused
06ef68c Prepared provider accounts, take-over, and services with no price
b93ca47 Update AdminProviderProvisioningService tests for null-hash no-password path (#14)
76a043a identity changes
68ca5ff UI changes and imorovements
```

**clinqetfuncations**
```
835134c Provider import worker: profile shell via the bootstrap factory; candidates capped to what Identity accepts
ea239be Provider import: check-file runner, item processor, lane advancer, sweeper, cost meter; tests for validator, cleaner, AI curation; greeting templates; unknown-hours indexing
7f57c67 Provider import readers: receptionist hours-not-listed test; prompt-size fixture carries hours
2eaf9a4 Provider import: tests for the import FAQ write path
8a6bb14 Quotes and search: retry a failed pause check immediately, and project a late pause now
ee5b5c1 Service AI validation: contact pre-check, manual review on no verdict, photo safety gate
feb36d3 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
51a1718 Voice call experience P1: supervisor hangup fence, latest-callback push, call timeline
03e1c2d Prepared provider accounts, take-over, and services with no price
364c548 Ask Clinket source viewer: audit fixes (comments)
```

**cosmosindexsetup**
```
045548c Search index: unknown hours stored as null per day
044865f Provider import phase 2: shared enums, PersonName, IsAdminProvisioned removed
194c4a5 Remove --remove-retired-alerts
542d487 Add --remove-retired-alerts (ServiceApprovedByAI)
45efd38 Prepared provider accounts, take-over, and services with no price
2a53263 Two plans (Free + Premium), yearly = 12x monthly, lead limits done right
c24d2e0 Search topology Phase 5: index swap, readable ranking numbers, search alerts, Sol 6.1
2caa2d1 SQL database renamed: identity -> clinket
08d8ae2 Guard listingReviewCount like every review count: on the index, never a boost
5078fc1 Search ranking programme: per-area fan-out, provider scoring, booking rules, audit fixes
```

**azureautomation**
```
0fb4360 Provider import infra: queues, private container, import model deployments, Identity key, settings
dba4031 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
7c4a8e5 Prepared provider accounts, take-over, and services with no price
45e8477 Rotate default Geocoding/StaticMaps API keys in deploy.ps1
ddf47d7 Two plans (Free + Premium), yearly = 12x monthly, lead limits done right
de5d9a1 Knowledge reading accuracy: never lose a word or a price
e0f102d Search topology Phase 5: index swap, readable ranking numbers, search alerts, Sol 6.1
e80e945 SQL database renamed: identity -> clinket
e0563a0 Functions: TrialReminders__TimerSchedule per stamp (CA 14:00 UTC, IN 04:00 UTC), required
664f60c AI Assistant number lifecycle: inventory, purchase, hold, keep-or-return, four screens
```

**clinqetwebadmin**
```
b69b39a Admin onboarding: a stored city-level address no longer blocks saving; notice when opening hours were never set
bcf703a Service approval queue reads every waiting type in one request
a0a90ee Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
34ae333 Merge pull request #10 from Clinqet/feature/offers-admin-polish
760e1e0 Offers admin: empty audiences save, a clearer yearly switch, a readable tooltip
1684dcb Prepared provider accounts, take-over, and services with no price
e6c5e35 Point the admin Maps key at the new Google key
b1ec78c Two plans (Free + Premium), yearly = 12x monthly, lead limits done right
8ddf049 Voice numbers: never return a number this environment did not buy
8b71d61 Merge pull request #9 from Clinqet/feature/offers-rules-look-lint
```

**clinqetwebpartnerapp**
```
0ed2a0aa Name prompt (N3), greeting without placeholder names (N2), typed names carried into the code check (N4)
89a26029 Hours never saved read as a suggestion: notice, Suggested labels, locations summary
abf233e4 Locations: move the default safely, in one transaction
fd7ae5c7 Route ServiceImageRemoved notifications to the service editor
aacedb1e Fix white strip under AI Assistant onboarding page while the cookie card is showing
d58be61f Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
7db9b079 Prepared provider accounts, take-over, and services with no price
85807b76 AI Knowledge: document title no longer breaks mid-word
157a7214 Refactor billing history API to support pagination and update related components for improved transaction display (#41)
3401d675 Read engines and plans from the catalogue, and show a total only when it is one
```

**clinqetwebuserapp**
```
662e0fe Greeting without placeholder names (N2), typed names carried into the code check (N4)
4c5fe6b Hours not listed: one plain line when a business has saved no hours, never Closed
15b7d2b City-only businesses: no at-store service address, no city-centre pin or directions, no empty JSON-LD address fields; booking works when no hours are listed
8bd154b Search: the header place box uses our place lookup
aa85d70 Search: place lookup goes through our API, and an empty result offers quotes
85d38ee Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
dcea812 Fix the CI breaks the prepared-provider change caused
38b5887 Prepared provider accounts, take-over, and services with no price
5c752df Merge branch 'master' of https://github.com/Clinqet/clinqetwebuserapp
d63b176 Rotate Google Maps API key
```

**clinqetmobilepartnerapp**
```
8685fc54 Name prompt sheet (N3), greeting without placeholder names (N2), typed names carried into the code check (N4)
1f8f1d2d Hours never saved read as a suggestion: notice, Suggested labels, location hours
e5d11e3e Locations: move the default safely, in one transaction
5e4363b2 test fixed
48542e3e Route ServiceImageRemoved notifications to the service editor (phone)
975b5314 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
1a1f71be Prepared provider accounts, take-over, and services with no price
fa42b3ab Billing history: receipts on iOS, and the numbered page API
90e1d192 Bring the rest of the web billing page to the phone, with nothing that sells
c78d8b51 Ask Clinket source viewer: full-screen viewer on the business app's /source-viewer
```

**clinqetmobileuserapp**
```
bf8514c Hours not listed: one plain line when a business has saved no hours, never Closed
5cb4830 City-only businesses: no at-store service address, area map and text search instead of a city-centre pin
5a9909f Search: a failed search is not an empty city, and the map stays on our API
efd368a Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
0cf8857 Declare *.webp so the image index type-checks
9b5257d Prepared provider accounts, take-over, and services with no price
2b4893f Swap the dashboard hero artwork and serve it as WebP
2bb0fae Two plans (Free + Premium), yearly = 12x monthly, lead limits done right
bc647a3 Sign-in options on one line at every width
3f01bf4 Consent: one question at a time on mobile
```

**clinqetmobileadminapp**
```
d853c39 Admin onboarding: a stored city-level address no longer blocks saving; notice when opening hours were never set
48b8916 Service approval queue reads every waiting type (admin phone)
2d48115 Prepared providers: UI verification fixes, price-awaiting rules, public page refresh
cd8005c Prepared provider accounts, take-over, and services with no price
62a7efb Point the admin Maps key at the new Google key
c7023da Voice numbers: never return a number this environment did not buy
9d2c07f Knowledge: Read again spends from the same daily limit
68a3a9d Knowledge: daily limit on Refresh suggestions
09d1c97 Knowledge reading accuracy: never lose a word or a price
2896dc5 Search topology Phase 5: index swap, readable ranking numbers, search alerts, Sol 6.1
```

**Nik**
```
32ca6db Provider import hand-over: NoTracking snooze bug fixed and recorded
a3c7e67 Provider import prompt: CI notes (convention fixes, SQL Server startup crash on the runner)
df84a66 Provider import prompt: integration-test flake notes
b6e9419 Provider import prompt: commit list from master after the rebase
126416f Provider import prompt: never-miss block (parked triggers, name-prompt decision, settings), master workflow, path fixes
bc86e0c Provider import hand-over: race fixed, minimum-spend offers, settings; prompt updated
c055617 Provider import: self-contained next-session prompt with full hand-over detail
df1b3e4 Provider import: build log decisions, hand-over notes and next-session prompt; deployment skill
35395ff Provider import build log: Phase 3b reader fixes, H-2 awaiting owner decision
d7df1dc Provider import build log: Phase 3 results, address and hours reader sweeps
```

## 8. Key code map (where each piece lives)
| Piece | Path |
|---|---|
| Settings class (all import settings, prompts as class defaults) | `clinqetshared/Models/AdminProviderImportSettings.cs`; Functions node `AdminProviderImport` in `clinqetfuncations/Clinqet.Communications/appsettings.json`; API subset in `clinqetapi/Clinqet.API/appsettings.json` |
| Identity endpoint settings | `clinqetshared/Models/ProviderImportInternalSettings.cs`; Identity appsettings `ProviderImportInternal` |
| Enums | `clinqetshared/Enums/ProviderImportEnums.cs`, `ProviderImportNormalizationEnums.cs`, `PhoneLineKind.cs`, `AdminAlertType.cs` (9 ProviderImport* types), `SpotlightType.cs` (`ProviderNamePrompt`, `IsSnoozable`) |
| Queue messages | `clinqetshared/DTOs/Messages/ProviderImportMessages.cs` (`validate:{runId}:{n}`, `item:{runId}:{itemId}:{attempt}`) |
| Identity DTOs | `clinqetshared/DTOs/Identity/ProviderImportAccountDtos.cs` |
| Admin DTOs | `clinqetshared/DTOs/Admin/AdminProviderImportDtos.cs` |
| Cosmos entities (SystemData) | `clinqetcore/Entities/COSMOS/ProviderImport.cs` — runs pk `provimport_runs` id `provimportrun_{runId}`; items pk `provimport_{runId}` id `provimportitem_{runId}_{itemKey}`; active runs `provimport_active`; daily cost `aiusage_import_{yyyyMMdd}` pk `provimport_usage` (0.0001 USD units) |
| Repositories | `clinqetcore/Interfaces/COSMOS/IProviderImportRepository.cs`, `clinqetinfrastructure/Data/COSMOS/ProviderImportRepositories.cs` (item methods take the item KEY) |
| Blobs | `clinqetinfrastructure/Services/ProviderImport/ProviderImportBlobStore.cs` — `{runId}/source.json`, `{runId}/items/{itemKey}/{input|prepared|ai-curation|shell|result}.json`, `_bank/{curation|review}/{key}.json.gz` |
| Upload file model + validator | `Services/ProviderImport/Models/ImportFile.cs`, `ProviderImportFileValidator.cs`, `ProviderImportSchemaModel.cs`; schema embedded at `clinqetfuncations/Clinqet.Communications/Resources/ProviderImport/` (keep `Data/provider-import/provider-import.schema.json` and the admin-web download copy identical) |
| Cleaner / skips / merge | `Services/ProviderImport/ProviderRecordNormalizer.cs`, `ImportTextRules.cs`, `NormalizedProvider.cs`, `ProviderImportSkipRules.cs`, `ProviderImportDeduplicator.cs`, `ProviderImportMerger.cs` |
| Existing-account matcher | `Services/ProviderImport/ProviderImportExistingMatcher.cs` |
| AI | `Services/ProviderImport/Ai/{CurationAnswer,CurationPrompt,ProviderImportCurator,CurationVerifier}.cs`; keyed AI client `ProviderImport` in `Configuration/ProviderImportServiceRegistration.cs` |
| Stage contracts | `Services/ProviderImport/ProviderImportStageContracts.cs` (preparer, writer, photo copier) |
| P1 / S2–S3 | `ProviderImportLocationPreparer.cs`, `ProviderImportProfileWriter.cs` |
| Web-name candidates | `Services/ProviderImport/FriendlyNameCandidates.cs` |
| Identity client | `Services/ProviderImport/ProviderImportIdentityClient.cs` (User-Agent `Clinket-ProviderImport/1.0`, header `X-Internal-Api-Key`) |
| Run slots + status sets | `Services/ProviderImport/ProviderImportRunSlots.cs` |
| Result document | `Services/ProviderImport/ProviderImportItemResult.cs` (`pendingApprovalServiceIds` is read by admin approve) |
| Admin service | `Services/ProviderImport/Admin/*` |
| Functions orchestration | `clinqetfuncations/Clinqet.Communications/Services/ProviderImport/{ProviderImportValidationRunner,ProviderImportItemProcessor,ProviderImportLaneAdvancer,ProviderImportSweeper,ProviderImportItemAiMeter,ProviderImportAlerts}.cs`; entry points parked at `Data/provider-import/handoff/ProviderImportFunctions.cs.txt` |
| Identity endpoint | `clinqetidentity/Clinqet.Identity.API/Controllers/Internal/ProviderImportInternalController.cs`, `Filters/ProviderImportApiKeyFilter.cs`, rate limiter + options in `Program.cs` |
| Provisioning core | `clinqetinfrastructure/Services/Auth/AdminProviderProvisioningService.cs` + `.Import.cs` |
| Friendly names | `clinqetinfrastructure/Services/Auth/{FriendlyNameService,FriendlyNameRules,FriendlyNameMirror}.cs` |
| Take-over hold lift | `clinqetinfrastructure/Services/Auth/ProviderTakeoverService.cs` + `Services/Provider/ImportedProfileActivation.cs` |
| Shared applier (refactored) | `clinqetinfrastructure/Services/AI/ProviderSetupApplier.cs`, `ProviderSetupApplyContracts.cs` |
| Bootstrap / lifecycle | `Services/Provider/BusinessProfileBootstrapService.cs`, `Services/Provider/ProviderLifecycleService.cs` (`ActivateImportedAsync`) |
| Admin API | `clinqetapi/Clinqet.API/Controllers/Admin/AdminProviderImportController.cs`; approve-hidden on `AdminProviderController` |
| Infra | `azureautomation/deploy.ps1`, `events.json`, `storage.json` |

## 9. Full detail of every unfinished item (copied from `handoff/*.md` — the same text, kept here so this prompt stands alone)

---

### From `handoff/phase5-writer-preparer-TODO.md`

## Phase 5 — profile writer + location preparer (handoff, 2026-10-07)

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
5. Offers with a MinimumSpend: DONE at hand-over (see the prompt §3a). Not done deliberately: `TimezoneMismatch` (no reason code), area history, branch/currency
   cache eviction, marketing address update.

---

### From `handoff/phase5-orchestration-tests-TODO.md`

## Phase 5 — orchestration tests still to write (handoff, 2026-10-07)

None written yet. Home: `clinqetfuncations/Clinqet.Communications.UnitTests/ProviderImport/` (xunit.v3 + Moq,
`[Trait("Category","Unit")]`, `[Trait("Feature","ProviderImport")]`, like `CurationVerifierTests.cs`). Name tests with §21 IDs
(F11, F14, F15, F17–F20, X1, X6, X9, X12–X15, X18, X19, X21, X22, V1–V3, V10, V11, FN3, FN5 …). Run with
`dotnet test Clinqet.Communications.UnitTests --filter "FullyQualifiedName~Clinqet.Communications.UnitTests.ProviderImport.<Class>"`
(VSTest; a full build of the test project takes ~5 min).

1. `FriendlyNameCandidatesTests` — order (bot, AI, slug, slug-city, -2..-N); accents, `&`→and, legal suffixes + "the" dropped;
   whole-word cut ≤ 20; initials fallback; non-Latin ⇒ only bot/AI; no duplicates.
2. `ProviderImportFakes` — run/item repositories honouring ETags (stale ETag ⇒ null; each write a new ETag), applying
   `PatchOperation` Set/Increment by JSON path through a Newtonsoft `JObject` round-trip (cast to `PatchOperation<T>`, read
   `.Value`); `UpsertManyAsync`, `ListAsync`, `CountByStatusAsync` from the stored items; daily spend dictionary; a CAS
   active-runs document so the real `ProviderImportRunSlots` works; a blob store fake with the `ProviderImportBlobStore` JSON
   options; the real `ProviderImportAlerts` over a recording `Mock<IServiceBusService>`.
3. `ProviderImportValidationRunnerTests` — mock `IProviderImportFileValidator` (records from
   `ProviderImportNormalizationFixture.Provider(...)`, each with its own name/email/phone or they dedupe), the real normalizer
   + deduplicator, a mocked `IProviderImportExistingMatcher`. Cases: not Uploaded/Validating ⇒ no-op; missing upload ⇒
   ValidationFailed; invalid envelope ⇒ ValidationFailed, errors capped; SchemaInvalid items; skip rules; dedupe skips;
   matcher skip / FillGaps / PossibleExistingBusiness; lanes (position % ParallelismPerRun, nextItemId, heads); counters;
   cost estimate; redelivery converges; LostRace.
4. `ProviderImportItemAiMeterTests` — budget = planned + MaxAiCallsPerProvider from `item.Ai.Calls` across attempts; run and
   daily limits ⇒ RunCostLimit; warning once on crossing (keys `run-cost-warning:{runId}`, `day-cost-warning:{yyyyMMdd}`);
   a bank hit costs nothing.
5. `ProviderImportLaneAdvancerTests` — next non-terminal item sent with attempt+1 and `MessageIdFor`; terminal skipped; last
   lane finishes with recomputed counts; CompletedWithErrors; Cancelling ⇒ Cancelled; stale-ETag finish does nothing; slot
   released; completion/custom-category/price alerts once (`completed:{runId}:{n}`, `summary:{runId}:{n}:custom-categories`,
   `summary:{runId}:{n}:prices`); paused run moves currentItemId, sends nothing.
6. `ProviderImportSweeperTests` — abandoned upload ⇒ Discarded + blobs deleted; stale validation re-sent
   `validate:{runId}:{attempts+1}`, after MaxStallRequeues ⇒ ValidationFailed + Stalled alert; stale lane re-sent; after
   MaxStallRequeues ⇒ item Failed Stalled + alert + advance; terminal current item ⇒ advance; fresh lane untouched; one broken
   run does not stop the others.
7. `ProviderImportItemProcessorTests` — mocks for curator, category prompt service (Lookup = `CurationTestData.Categories`),
   preparer, identity client, account store, profile repo, bootstrap, writer, photo copier, lifecycle; real `CurationVerifier`
   and `ProviderImportLaneAdvancer`. Every case: terminal / stale attempt / claim / paused / Cancelling; ContentRefused ⇒
   Skipped, no Identity call; merge veto + NoCity at P5; P5 re-check skip + FillGaps switch; each Identity outcome; Identity
   Unavailable ⇒ PausedIdentityUnavailable + one High alert + item Queued; AI unavailable below threshold ⇒
   `ProviderImportTransientException`, at threshold ⇒ PausedAiUnavailable; PausedCostLimit; AiBudgetExhausted; OwnerTookOver;
   verdict Live / blockers / FillGaps never activates; `PendingApprovalServiceIds` in the result blob; redelivery after each
   checkpoint repeats nothing (no 2nd AI or account call); `Reconcile()` agree/disagree.
   ‼️ `Reconcile` is `internal static` and `Clinqet.Communications` has no `InternalsVisibleTo` for its unit tests — check
   first; either add it (host csproj change) or test through `ProcessAsync`. Also check the FillGaps re-check on a redelivery
   (the processor reads `Mode`, `ExistingUserId`, `Links` from the item).
8. Sabotage ≥ 4.

---

### From `handoff/phase5-ai-curation-TODO.md`

## Phase 5 — AI curation, verification, bank (handoff, 2026-10-07)

DONE: `clinqetinfrastructure/Services/ProviderImport/Ai/` — `CurationAnswer.cs`, `CurationPrompt.cs` (input + strict schemas,
chunking), `ProviderImportCurator.cs` (keyed "ProviderImport" AI client, bank, truncation split, schema retry, cost from
TokenPricing, meter), `CurationVerifier.cs` (§9.4). System prompts in Functions appsettings = class defaults. Tests 396/396
under `ProviderImport|BankRulesVersion`: CurationVerifierTests 97, CurationPromptTests 25, ProviderImportCuratorTests 20,
ProviderImportAiPromptSettingsTests 6, BankRulesVersion pin `(1, "64f4a480857ce7ee")` for both versions. Two bugs fixed:
empty serviceIndex enum; VerifyHours missing finding.

NOT done:
1. Sabotage ≥ 3: remove the `numbers.Any(n => n <= 0 …)` guard in `CurationVerifier.VerifyPrice`; drop `WriteBankAsync` in
   `ProviderImportCurator.CallAsync`; put `scrapedAt` into `CurationPrompt.Input`.
2. `ProviderImportCurator` is NOT yet registered in DI (`AddProviderImportWorker`) — register it (Scoped/Transient; it takes
   the keyed AI client).
3. `AiModelPinConventionTests` registry: add the two import deployment names if that test requires every deployment string.
4. Two CS8601 warnings in `ProviderImportProfileWriter.cs` (~L487-490, offer Description/Conditions) — decide null handling.

---

### From `handoff/phase5-normalizer-TODO.md`

## Phase 5 — cleaner, skip rules, in-file merge (handoff, 2026-10-07)

DONE: 188 tests pass (`ProviderRecordNormalizerTests`, `ProviderImportSkipRulesTests`, `ProviderImportDeduplicatorTests`,
`ProviderImportNormalizationSettingsTests`). Files: `NormalizedProvider.cs`, `ImportTextRules.cs`, `ProviderRecordNormalizer.cs`,
`ProviderImportSkipRules.cs`, `ProviderImportDeduplicator.cs`, `ProviderImportMerger.cs` (clinqetinfrastructure/Services/
ProviderImport); `clinqetshared/Utilities/SocialPlatformHosts.cs` (moved out of `ProviderSetupProfileService`, same
behaviour — the API suite covering it was NOT run); new enums `ProviderImportNormalizationEnums.cs`;
`ProviderImportReviewReason.PriceDropped` appended; `Normalization.DirectoryHosts` setting; Functions appsettings
`AdminProviderImport:Normalization` lists filled (SharedContactBlocklist empty until the pilot).

Readings taken (not stated by the plan): MG4 same name in different cities ⇒ `PossibleDuplicateInFile`; a merge member with no
hours is ignored, stated hours must match exactly else no hours + `HoursConflict`; franchise rule = brandName on any member
and names or primary cities differ; a missing contact purpose = main; an extension phone links only on number + extension;
added flags `StaleSource`, `PossiblyClosed` (temporarily closed), `ConflictsInSource`; CA/US provinces → 2-letter codes, an
Indian state kept as written; closed every day ⇒ `HoursIncomplete`.

NOT done:
1. Sabotage (six breaks: gmail dot key, conflict check, franchise rule, toll-free linking, home-street rule, zero price) — never
   ran (build blocked at the time). Copy the three files to scratch, apply, run only these classes, copy back, diff.
2. Full Communications unit suite run.
3. DI: `ProviderRecordNormalizer` (IOptions<AdminProviderImportSettings>, IOptions<DiscoverySettings>, TimeProvider) and
   `ProviderImportDeduplicator` as singletons in Functions `Program.cs` AND `FunctionAppFactory` (trap T-5).
4. Skills/memory.

---

### From `handoff/phase4-identity-tests-TODO.md`

## Phase 4 — Identity tests still to write (handoff, 2026-10-07)

Home: `clinqetidentity/Clinqet.Identity.IntegrationTests/Tests/ProviderImport/` (new folder). Identity's `Program.cs` is the
only host that registers `ProviderTakeoverService` and the internal controller (§0.18).

### Suspected defect — FIXED (2026-10-07)
See the race fix in `NEXT-SESSION-PROMPT-2.md` §3a. The race class is written; still write the rest below.

### Fixture facts
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

### Classes to write
1. `ProviderImportAccountsEndpointIntegrationTests`: Created; AlreadyCreated/X2; ExistingPrepared (C15/X3/X4/C17);
   ExistingTakenOver (C12/C16); ExistingSelfRegistered (C14); ExistingClosed (C27/X36); ContactOnTwoAccounts (C13);
   PendingInvitation (X7); CustomerRecord (X8); InvalidRequest (400 naming the field); OwnershipLimit; key/boot (401, 401,
   400, boot fails); 429 + Retry-After; race same contact different userIds ⇒ one account + ExistingPrepared; (same-userId race DONE in
   `ProviderImportAccountRaceIntegrationTests`); nothing sent (offer-match, notification, email, SMS).
2. `ProviderImportFriendlyNameEndpointIntegrationTests`: FN1, FN2, FN4, AlreadyHeld same slug, not this user's prepared
   business ⇒ 400, no `FriendlyNameUpdated`.
3. `ProviderImportTakeoverHoldLiftIntegrationTests`: X22, X23, non-Pending untouched.
Sabotage ≥ 3 (copy to scratchpad, mutate, see it fail, copy back, `diff`). Run only these classes; report exact counts.

---

### From `handoff/phase4-names-TODO.md`

## Phase 4 — names (N1/N2/N4/N5) + friendly-name service (handoff, 2026-10-07)

DONE and tested (each behaviour sabotage-checked):
- `IFriendlyNameService.TrySetAsync` (`clinqetinfrastructure/Services/Auth/FriendlyNameService.cs`) on the shared
  `FriendlyNameRules.cs` + `FriendlyNameMirror.cs` (Cosmos copy + `FriendlyNameProjectionFailure` alert, moved out of
  `UserProfileController` unchanged). AlreadyHeld, candidates in order, `Tried`, clash at save ⇒ next candidate, concurrent
  same request ⇒ the winner's name, never `FriendlyNameUpdated`. `AuthService` PUT UserProfile uses the shared rules.
  Registered in Identity `Program.cs`.
- N1: `HandleExternalLoginAsync` after a take-over fills only placeholder halves from verified claims
  (`ProposedPersonName.FromClaim`).
- N2: `TemplateService.ProcessTemplate` fills `{{Greeting}}` (`PersonName.Greeting`, HTML-encoded); 295 templates (59 × 5
  languages) moved to `{{Greeting}}`; keys `Greeting_Named`, `Greeting_Anonymous`, `MemberDisplayName_AccountOwner` in 5
  languages; AuthService call sites pass First/Last; `MemberDisplayName.Of` real halves → email → label; take-over alert text;
  Razorpay contact uses the business name for a placeholder person.
- N4: `VerifyMfaDto.ProposedFirstName/ProposedLastName` (no validation attributes on purpose); applied only on `TakenOver`.
- N5: the "name differs" take-over alert is Medium; `NameDiffers` compares only real halves.
- Identity integration fixture: `ProviderImportInternal:ApiKey = integration-test-provider-import-internal-key-0001`.
Tests: Identity unit (ProposedPersonNameTests 25, FriendlyNameServiceTests 14, TakeoverNamesTests 13,
ProviderTakeoverAlertTests 8, GreetingRenderTests 17), Identity integration real SQL (FriendlyNameServiceIntegrationTests 3,
TakeoverNamesIntegrationTests 4), Communications EmailGreetingRenderTests 4, API MemberDisplayNameTests 8 + 3 + 3.

NOT done:
1. Run each touched unit suite IN FULL once: `Clinqet.Identity.UnitTests`, `Clinqet.API.UnitTests`,
   `Clinqet.Communications.UnitTests` (a processor test asserting a rendered "Hello X" may now fail because of `{{Greeting}}`).
2. Sabotage the integration clash path: change the `continue` after the clash catch in `FriendlyNameService` to `throw;` and
   confirm `FN6_ACandidateTakenAtSaveTime…` fails.
3. The localized "Account owner" label is wired only in `TeamLifecycleNotifier`. Still empty for a member with no real name
   and no email: `ProviderInboxService` (~L270, ~L630), `MemberLifecycleService` (~L129, ~L804), `BusinessMemberDirectory`
   (~L262), `WorkAssignmentService` (~L125), `BusinessNotificationSettingsService` (~L686), admin tenancy services — needs a
   per-recipient label or the client's own label.
4. `GET friendlyname check` (`UserProfileController` ~L504-558) keeps its own copy of the rules and does not lower-case before
   the format check — move it onto `FriendlyNameRules` (a small behaviour change: say so).
5. Skills ×4 (identity-api, prepared-providers, auth-sessions, notifications) + memory not updated for these.
6. UI greetings by name (N2 client side) — behind the N3 mockup gate: provider web
   `src/components/dashboard/layout/Header.jsx` L109-142 (`src/utils/displayName.js` `displayFirstName`); provider phone
   `src/Screen/homeTab/MyDashboardScreen/index.tsx` L170, L663 (`MY_DASHBOARD.WELCOME_BACK`); customer web
   `components/layout/customer/header.jsx` L314, L691 (`header.hello`); admin `src/utils/adminIdentity.js` L9. N4 client side:
   send `proposedFirstName/proposedLastName` from provider web `registerForm.jsx` / `PreparedProfileReady.jsx` and provider
   phone `RegisterScreen`.

---

### From `handoff/phase6-admin-api-TODO.md`

## Phase 6 — Main API admin endpoints (handoff, 2026-10-07)

DONE (compiles; unit tests 187/187 under `FullyQualifiedName~ProviderImport|FullyQualifiedName~AdminProviderControllerTests`):
`clinqetapi/Clinqet.API/Controllers/Admin/AdminProviderImportController.cs` (`api/v1/admin/provider-imports`, Admin role):
upload-url, {runId}/check, list, get, items (status/continuation/pageSize), item detail (5-min read links + ClaimedAt + live
profile status), start/cancel/resume/retry-failed/discard/cost-limit, item approve/retry/remove, bulk approve (≤200),
report.csv (skipped|review|all, formula-guarded). Trust page: `POST api/v1/admin/providers/{businessId}/approve-hidden` on
`AdminProviderController`. Services in `clinqetinfrastructure/Services/ProviderImport/Admin/` (admin service, mapper, CSV,
upload storage with streamed SHA-256 pinned to the blob ETag, SQL account store). `ProviderImportRunSlots` +
`ProviderImportStatuses` shared with the worker. New `IAzureStorageService.GetCreateSasUrlAsync` (Create|Write, one path,
never Delete). DTOs `clinqetshared/DTOs/Admin/AdminProviderImportDtos.cs`. API `Program.cs` + appsettings `AdminProviderImport`.

NOT done:
1. API integration tests (`Clinqet.API.IntegrationTests`, `ClinqetApiFactory`, Cosmos emulator + Azurite): run list paging newest
   first; `CountByStatusAsync` GROUP BY; `provimport_active` CAS race; `UpsertManyAsync` idempotent; start → item messages over
   HTTP with an admin token (`MockServiceBusService.SentToQueues`); upload-url → PUT to Azurite → check (SHA-256 + validate
   message). Put every class touching `provimport_active` in one `[Collection]`.
2. SQL integration test for `ProviderImportAccountStore` (conditional `ExecuteUpdateAsync`, batched lookup) — "Seo SQL"
   collection, own id prefix "PI".
3. Sabotage: drop the ETag condition in `TransitionRunAsync`; MaxConcurrentRuns + 1; remove the retry-lane revert; remove the CSV
   formula guard; remove the `ClaimedAt == null` condition.
4. Full `Clinqet.API.UnitTests` run (incl. the convention tests that scan every controller).
5. Skills ×4 (main-api, admin-app) + memory.
Read-link lifetime, bulk-approve cap and the default runs page size are settings now (prompt §3a).
Edge: an owner who takes over between the closure and the deactivation keeps an active account on a closed business; the admin
is told so.
Fixed at handback (2026-10-07): item point reads/patches now map the item KEY to the document id
(`ProviderImportKeys.ItemId(runId, itemKey)`) in `ProviderImportItemRepository` — `item.ItemId` is the 16-hex key, NOT the
document id. Re-check the admin fakes/tests assume the same.

---

### From `handoff/phase9-ui-TODO.md`

## Phase 9 — name prompt (N3), greetings (N2 UI), names into the code check (N4 clients) (handoff, 2026-10-07)

Mockup `Data/mockups/provider-name-prompt` registered; owner waived waiting for approval (2026-10-07).

DONE:
- Server: snoozable dismissal (`SpotlightTypeRules.IsSnoozable`, only `ProviderNamePrompt`; `UserMetadataService.DismissSpotlightAsync`
  moves DismissedAt/UpdatedAt — no new column); `UserProfileDto.ClaimedAt` filled in Identity `UserProfileController` GET (DTO
  only); `NamePromptSettings` (`NamePrompt:SnoozeDays` 7) → `AppConfigDto.NamePrompt`. Unit tests pass (Identity 92/92, API 17/17).
- Provider web: `src/lib/namePrompt.js`, `src/components/dashboard/NamePrompt.jsx` (mounted in `src/app/dashboard/layout.jsx`),
  `src/utils/personName.js` greeting, `src/lib/proposedNames.js` + register/PreparedProfileReady/verifyLoginPhoneForm (phone code
  only); keys in 5 languages; `Dashboard.WelcomePrefix` removed. Tests pass; ESLint 0.
- Customer web: N4 (`lib/proposedNames.js` …) + N2 (`utils/personName.js`, header). Tests pass; ESLint 0.
- Provider phone: `src/lib/namePrompt.ts`, `src/hooks/useNamePrompt.ts`, `src/components/NamePromptSheet.tsx` (on
  `BookingSheet`), N2 greeting, N4 params RegisterScreen → LoginOTPScreen; keys in 5 languages. tsc clean; tests pass
  (684 regression tests over touched shared files).

NOT done:
1. Provider phone N4 tests (LoginOTPScreen sends the params with the phone verify only; RegisterScreen navigates with them).
2. Customer phone (`clinqetmobileuserapp`): N4 (PreparedProfileReady.tsx + RegisterScreen → LoginOTP params → phone verify) and
   the home greeting (`src/screen/homeTab/homeScreen/index.tsx` ~L379 `HOME_SCREEN.HELLO`) must filter "Guest"/"User"; jest tests.
3. DONE 2026-10-08: both integration tests run and pass. The Identity one exposed a REAL bug, fixed: the second "Not now" was
   never saved (`UserMetadataService.DismissSpotlightAsync` loaded the row without `AsTracking()` while the Identity host is
   `QueryTrackingBehavior.NoTracking`, so `SaveChangesAsync` wrote nothing). Now `.AsTracking()`; `UserMetadataControllerIntegrationTests`
   25/25 on real SQL (failed before the fix); API `AppConfigEndpointTests` 6/6.
4. Sabotage proofs for every new suite (4 apps + 2 hosts).
5. Viewport checks 320/375/768/1024/1440 (web prompt) and simulator light/dark (phone sheet).
6. Skills ×4 + memory (spotlight snoozable type, partner app, provider mobile, user app, customer mobile, auth sessions N4).
7. Stale comments: `preserveAccountSettings` (provider web `src/services/authServices.js`) and `withAccountSettings` (mobile
   `editProfileAPI.tsx`) still say a missing `ReceiveMarketingEmails` is saved as true — no longer true after the null-keeps fix.
8. DECIDED (owner, 2026-10-07): "Not now" on web OR phone snoozes both — keep it; test it on both apps.

---

## 10. Definition of done for the whole programme
- Every §25 phase finished; every §21 row has a passing test named with its ID; every guard sabotage-checked.
- Every test project and app builds; every FULL suite run once at the end and passes 100% (Identity unit + integration,
  API unit + integration, Communications unit + integration, cosmosindexsetup tests, the four web/phone apps' jest + ESLint 0).
- The Functions host boots with every import service registered (DI validation test).
- Pilot numbers recorded in SOLUTION §20; skills + memory updated; `handoff/` emptied and deleted; BUILD-LOG current.
- **§27 audit done in full** (audit → fix every finding → re-verify every fix) and reported with the §27.5 evidence.
- Committed and pushed in every repo (on `master` when the owner asks, as a fast-forward); `git rev-list --merges` empty; trees clean.
