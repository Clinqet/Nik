# Provider Import — build log

> Working record of the implementation of `SOLUTION.md`. Every "verify" the plan asks for is answered here with
> what the code showed. Newest entries at the bottom of each section.

## 0. Environment (cloud session, 2026-10-07)

| Fact | Consequence |
|---|---|
| .NET 10 SDK 10.0.401 installed in the session; Docker available (Testcontainers runs) | every project, test project and real-engine integration suite can be built and run here |
| Azure SQL (`clinket-ca-nonprod`, `clinket-in-nonprod`, TCP 1433) is **not reachable** from this sandbox; Cosmos rejects the sandbox IP (account firewall) | the SQL migration cannot be applied to CA + IN from here, and the pilot cannot run against sandbox CA. The exact commands are in §9 for the owner. Azure OpenAI is reachable over HTTPS |
| Repos are checked out side by side under `/home/user` on branch `claude/affectionate-davinci-wdczbr` | the same relative project references as `C:\Nik` |

## 1. Pre-existing defects found before any change

| # | Where | What | Done |
|---|---|---|---|
| PRE-1 | `clinqetidentity/.../Controllers/Admin/AdminAccessController.cs:184` | `clinqetcore` commit `cec54c3` (another session, 2026-10-07) renamed `AdminAlertQuery.AlertType` → `AlertTypes`; Identity was never updated, so **the Identity API did not compile at the branch heads**. Every Identity step of this programme needs it to build | one-line fix `AlertTypes = new[] { alertType }` — the same meaning as before |

## 2. Baseline ("before") test runs — sources untouched except PRE-1

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | 16,393 passed, 0 failed |
| `Clinqet.Identity.UnitTests` (with PRE-1) | 1,436 passed, 0 failed |
| `Clinqet.Communications.UnitTests` | 9,893 passed, 0 failed |
| `Clinqet.Mcp.UnitTests` | 1,556 passed, 0 failed |
| `ClinqetCosmosAIIndexSetup.UnitTests` | 397 passed, 0 failed |
| integration suites (API, Identity, Functions, MCP) | run on a frozen snapshot of the untouched sources — results below |

## 3. Plan "verify" points — what the code showed

(filled in as each phase reaches them)

## 4. Readings of the plan where two statements differ

| # | Plan text | Code | Reading taken |
|---|---|---|---|
| R-1 | §8.9.1 "words of ≤ 4 letters written in capitals … stay upper-case; reuse `ToTitleCase`, which already keeps short all-caps words" | `StringFormattingExtensions.ToTitleCase` keeps all-caps words of **≤ 3** letters | reuse `ToTitleCase` unchanged (≤ 3) + `Normalization:KnownAcronyms` (HVAC, ESA…) restored to capitals. Keeps X30 ("AAA HVAC Services") true without leaving "BEST", "CALL", "WEST" shouting |
| R-2 | §14.5 / D20: take-over "name differs" alert → **Medium** | `admin-provider-setup/findings/REMAINING-WORK` "Alert severities — FINAL (owner-set 2026-10-06)" lists it as **High** | SOLUTION D20 is the later, explicit owner decision about exactly this line and names the High code it replaces ⇒ Medium |

## 5. Design of the shared refactors (decided from the code, 2026-10-07)

**Zero-regression constraint that shapes everything:** the existing suites construct `McpService` (API unit + 3 API
integration suites) and `BusinessProfileController` with their exact constructors. So the new shared services are
COMPOSED inside those two classes from the dependencies they already receive (one class, one code path, no new
constructor parameter), and are ALSO registered in DI for the Functions host. Each new service has a public DI
constructor (`ILogger<T>`) and an internal one taking the composing class's own logger, so existing log assertions
keep seeing the same logger.

| Piece | Shape |
|---|---|
| `IProviderSetupApplier` (`clinqetinfrastructure/Services/AI/ProviderSetupApplier.cs`) | `IAsyncEnumerable<ProviderSetupApplyEvent> ApplyAsync(ProviderSetupApplyRequest)` — progress events (services count, batch progress, images) + one terminal event (result or profile failure). McpService maps progress to the SAME `AiResponseDto` messages at the SAME points, so SSE order is unchanged. Stages moved verbatim: fact checks → profile → price ceiling (+alert) → price gate → taxonomy (+custom, +alerts) → taxonomy-confidence alerts → service areas → hours → services (pre-pass, offering judge, writes, counts, derivatives, pricing notifications) → offers → image lane → onboarding progress. What stays in McpService: blob/file validation, manifest read/projection, document reading, the extraction-chunk alert, the reading-outcome report, and the SSE wording |
| Options (every `manifest != null` branch) | `RunFactChecks`, `RunPriceGate`, `RunOfferingJudge`, `RaiseTaxonomyConfidenceAlerts`, `RunImageLane`, `NameIsAuthoritative`, `DescriptionIsAuthoritative`, `PriceReviewCeilingBase` + `PriceReviewCeilingSettingKey`, `ServiceCreationBatchSize`, `ProgressEventEveryRecords`, `AlertMode` (default `PerEvent`), `NotifyProvider` (default true), `ExistingServiceMode` (default `MatchAndUpdate`) |
| Import-only inputs (null for McpService ⇒ skipped) | prepared addresses (street optional, deterministic `AddressId`, coordinates from P1), prepared service areas (centre + radius from P1 — never re-geocoded), explicit week or "no hours", FAQs, licences, deterministic service ids, the R4 price-add |
| `AlertMode.CollectForSummary` | the resolver, the ceiling alert and the confidence alert hand their would-be alert to a `ProviderSetupAlertCollector` instead of sending it. Resolver: NEW overload taking the collector; the existing 6-argument `ResolveAsync` is untouched and delegates with none, so its mocks and callers are unchanged. In collect mode the resolver still refuses when `CategoryAlert:EnableCustomCategoryAlerts` is off (SV10) |
| `IBusinessProfileBootstrapService` | the whole `POST business/profile` creation logic; options `SeedDefaultAvailability` (true), `AlertMode` (PerEvent), public email/phone (from token claims by default) |
| `ProviderLifecycleService.ActivateImportedAsync` | Pending → Active conditional patch, no alert. Provider `POST business/profile/reactivate` narrowed to Inactive → Active |

**§17.2 ASK condition — NOT met (no question to the owner):** `AiBudgetGovernor.AcquireAsync` returns a no-op lease
for every lane except `Bulk` (`AiBudgetGovernor.cs` ~L81). The import's keyed `AICompletionService` (own endpoint, key,
API version, retries, timeout from `AdminProviderImport:Ai`) calls on the Interactive lane, so it never takes one of
the shared bulk slots; its concurrency is its own lanes and its tokens-per-minute is its own deployment's cap.

**Daily import cost counter:** the existing `AiUsageCounter` family (`Count` is an `int`) with `Meter = ProviderImport`,
pk `provimport_usage`, id segment `import_`; the count is the day's spend in units of **0.0001 USD** (each call's cost
rounded UP), so no new field is needed and a $100/day limit is 1,000,000 units — far from `int` range.

## 6. Traps found in research (each needs a test)

| # | Trap | Handling |
|---|---|---|
| T-1 | `ProviderSetupServiceWriter` create path RESURRECTS a soft-deleted row at the same deterministic id (F-8). A re-import must never bring back a service the provider deleted | import's CreateOnly checks `GetServiceIncludingDeletedAsync` first; a tombstone ⇒ "Not applied — removed by the business" |
| T-2 | Offer ids are seeded from the setup file URL | import seeds from a constant import identity + signature, so a re-upload converges |
| T-3 | All three profile-create paths create Active | import uses the bootstrap with Status Pending from the first write |
| T-4 | Functions has no `AIAssistant:ProviderAttachmentProcessing` / `Discovery:CountryDefaults` sections | add exactly the keys the applier reads, same values as the API (DI audit) |
| T-5 | `FunctionAppFactory` (integration fixture) never runs Program.cs | every new service also registered there |
| T-6 | `$modelDeployments` entries all have name == modelName; import deployments differ | deploy.ps1 must support name ≠ modelName and assign the content filter |
| T-7 | Identity `RequiredHeadersMiddleware` 400s a request without `User-Agent` and does not exclude `/internal` | the Functions Identity client always sends `User-Agent: Clinket-ProviderImport/1.0` |
| T-8 | SystemData composite is `(type, createdAt DESC, id DESC)`; status-filter + sort would need a new composite (schema) | runs page: `type` + ORDER BY createdAt DESC, id DESC (existing composite); items: `type` [+ `status`] with NO ORDER BY (continuation paging, client sorts by ordinal) — no index change |
| T-9 | `AdminAlertMessage.EventId` is a Guid | every deterministic alert key goes through `DeterministicGuid.Create(...)` |
| T-10 | Identity has hand-rolled in-memory throttles only (3 already) | the internal endpoint's per-minute limit follows the same pattern; the skill's "third counter ⇒ shared helper" rule is noted for the audit |

## 7. Mockup `Data/mockups/provider-name-prompt` (drawn 2026-10-07, registered in `Data/mockups/REGISTER.md`)

Owner waived waiting for approval in conversation (2026-10-07). Findings while drawing it:
- **Both customer apps already handle the 409 `PreparedProfileSignIn`** (`clinqetwebuserapp/components/auth/PreparedProfileReady.jsx`,
  `clinqetmobileuserapp/src/components/PreparedProfileReady.tsx`, commit 38b5887) — `REMAINING-WORK` P1-2 is stale. N4 for the
  customer apps is therefore only "carry the typed name into the code verify".
- **Customer wording kept as built.** The sheet drew the provider title on the customer step; the customer apps' existing title
  ("This number already has a business on Clinket") is the customer wording PLAN §4.3 row 17 approved, so it is NOT changed.
- `Dashboard.WelcomePrefix` (web) / `MY_DASHBOARD.WELCOME_PREFIX` (phone) become unused once the no-name greeting ships → deleted then.
- Customer web keeps login phone details in `SessionStore`; the typed name must stay in memory only.

## 8. Phase 2 done (2026-10-07)
- Enums: 9 `AdminAlertType`, 2 `UserActivityTypes`, `UsageMeter.ProviderImport`, `SpotlightType.ProviderNamePrompt`, `AiSubFlows` J1/J2, `ProviderImportEnums.cs`.
- `PersonName` (`clinqetshared/Utilities`). `UserProfile.PreparedFilter` / `IsPreparedState` / `IsPrepared` / `IsProvisioned` — the one definition.
- `IsAdminProvisioned` removed at every site: `UserProfile`, `IProviderTakeoverService` (`knownProvisioned`), `ProviderTakeoverService` ×3,
  `PreparedAccountDirectory` ×2, `PreparedProviderService`, `AdminProviderProvisioningService` ×3, `AuthService` ×8, `AppDbContext`,
  `cosmosindexsetup/DataMigration/PreparedProviderDataMigration.cs` raw SQL ×2, 5 test files. Docs/skills: §26.
- Migration `20261007180001_RemoveUserProfileIsAdminProvisioned` — Up THROWS if any row's flag disagrees with `ProvisionedAt`
  (this replaces the pre-check query the plan asked for, which this sandbox cannot run; it now runs inside the migration on CA and IN);
  Down restores the flag from `ProvisionedAt`.
- `PUT UserProfile`: `ReceiveMarketingEmails` null = keep. Tests: 4 cases; sabotage (`?? true`) fails them.
- Identity unit: 1,469 passed (baseline 1,436 + 33 new).
