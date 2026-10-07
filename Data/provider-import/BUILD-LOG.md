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
| PRE-2 | `clinqetapi/Clinqet.API.IntegrationTests/Tests/BillingCatalogV3ReleaseIntegrationTests.cs` | the two tests share one SQL database (collection fixture); `SeedAsync_OlderVersion_…` asserted its first seed INSERTED rows, so it failed whenever its sibling ran first (it did in the after-run; passes alone) | seed without asserting a count, as the sibling already does — the test's real assertions are unchanged |
| PRE-1 | `clinqetidentity/.../Controllers/Admin/AdminAccessController.cs:184` | `clinqetcore` commit `cec54c3` (another session, 2026-10-07) renamed `AdminAlertQuery.AlertType` → `AlertTypes`; Identity was never updated, so **the Identity API did not compile at the branch heads**. Every Identity step of this programme needs it to build | one-line fix `AlertTypes = new[] { alertType }` — the same meaning as before |

## 2. Baseline ("before") test runs — sources untouched except PRE-1

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | 16,393 passed, 0 failed |
| `Clinqet.Identity.UnitTests` (with PRE-1) | 1,436 passed, 0 failed |
| `Clinqet.Communications.UnitTests` | 9,893 passed, 0 failed |
| `Clinqet.Mcp.UnitTests` | 1,556 passed, 0 failed |
| `ClinqetCosmosAIIndexSetup.UnitTests` | 397 passed, 0 failed |
| `Clinqet.API.IntegrationTests` (snapshot) | 2,658 passed, 18 skipped, 0 failed |
| `Clinqet.Identity.IntegrationTests` (snapshot) | 657 passed, 0 failed |
| `Clinqet.Communications.IntegrationTests` (snapshot) | 963 passed, 0 failed |
| `Clinqet.Mcp.IntegrationTests` (snapshot) | 129 passed, 0 failed |

## 3. Plan "verify" points — what the code showed

### V-1 §8.5.6 — every reader of a city-level business address (`Street = ""`, ZipCode maybe "") — swept 2026-10-07
Text formatters almost all filter blanks already (web/phone profile header, About tab, cart, booking detail, partner lists,
voice context, search index — which never stores Street —, emails/SMS — which carry no business address). Defects to fix
before the first city-level address is written:

| # | Where | Defect | Fix |
|---|---|---|---|
| A-1 | `clinqetinfrastructure/Services/Documents/QuestPdfService.cs` ~548, ~831, ~1305 (provider box) + ~1285 (bill-to) | ", Toronto" (leading comma) | one shared "join the non-blank parts" helper |
| A-2 | `clinqetshared/DTOs/COSMOS/Cosmos.cs` `AddressDto` `[Required]` Street/ZipCode, used as `BookingRequestDto.ServiceAddress`; web `bookingPopUp.jsx` ~105 and phone `QuickBookScreen.tsx` ~351 copy the business address for an at-store booking | **every at-store booking with a city-level business → 400** | server: an at-store booking's place is the business's own address — validated against the profile, not the copied street |
| A-3 | customer web `businessProfile.jsx` ~1278 `handleDirection`, `profile/AboutTab.jsx` ~253 directions + ~296 embedded map; customer phone `BusinessProfileScreen.tsx` ~1221, `components/AboutTab.tsx` ~16-46 static map `Place` + ~141 | directions / street-zoom pin to the CITY CENTRE | blank street ⇒ map search on "city, state, country" (no pin / area zoom) |
| A-4 | customer web `lib/seo/dynamic-seo.js` ~233-255 | `"streetAddress":""`, `"postalCode":""`, `geo` at the city centre | omit empty keys and `geo` when street is blank (as `serviceSeo.js` does) |
| A-5 | admin web `providers/onboarding/StepBusinessDetails.jsx` ~254-294, admin phone `StepBusinessDetails.tsx` ~263-337 | the admin cannot save Step 1 (even a name change) without inventing a street, because City is prefilled | require street/postal only when the admin edits the address fields, not when a city-level address is merely loaded |
| A-6 | voice context / business-search profile tool | `"street":""` in JSON (no artefact) | blank ⇒ omitted (hardening) |
Kept as decided (D10): the provider's own address form keeps "street required" — the owner types it when they edit.

### V-2 §8.6 — every reader of business hours with ZERO availability documents — swept 2026-10-07
Backend rule already "missing = not configured, never closed" (`BranchAvailabilityResolver`, `PublicAvailabilityWeek` sends
`isConfigured:false`). Customer phone app, service page, location hours, schema.org, voice gates, MCP booking gates, booking
creation: all OK. Defects:

| # | Where | Defect | Fix |
|---|---|---|---|
| H-1 | customer web `cart/model/selectDateAndTime.jsx` ~72-81 | **no slots ⇒ a business with no hours cannot be booked on web** (and an unconfigured day in a partial week) | ignore `isConfigured === false` rows (as the phone app does) |
| H-2 | `ProviderSearchIndexer.cs` ~536-551 (field already `bool?`) + both filter builders (`ProviderSearchFilterBuilder.cs` ~146, `SearchFilterExpressionBuilder.cs` ~225) | unknown hours indexed as closed every day ⇒ excluded from "available on {day}" | provider index: null when no rows; filter `ne false` |
| H-2b | `AzureSearchIndexer.cs` ~2128-2192 service index, `SearchDocument.cs` ~765 `IsAvailable` is plain `bool` | same, on the SERVICE index | needs `bool?` = a search-index field change ⇒ **§0.7 ASK** |
| H-3 | `RealtimeSessionPayloadBuilder.cs` ~590-629, ~861 (+ `ProviderContextTools`) | profile "authoritative for working hours" with `weeklyAvailability: []` ⇒ the receptionist may say "we're closed" | an explicit "hours not listed — never say closed" line when empty (voice prompt change ⇒ bank/prompt versions checked) |
| H-4 | `GetBusinessProfileTool.cs` ~110 | `weeklyHours: []` without the note `get_availability` gives | attach `BusinessSearchToolNotes.NoAvailability` |
| H-5 | private `GET business/availability` (`AvailabilityController.cs` ~190-212) and the three hour editors + locations list | invents 09:00–17:00 as if saved | add `isConfigured`; editors show "Hours not set yet" |
| H-6 | onboarding Availability step / `AudienceAccountRule` `Progress >= 100` | an hours-unknown business is never "complete" | intended nudge — kept (the owner sets hours after take-over) |
`BusinessProfileBootstrapService`: the import passes `SeedDefaultAvailability = false` (pinned by test).

### V-1 / V-2 — fixed (Phase 3b, 2026-10-07)
| # | Done |
|---|---|
| A-1 | `QuestPdfService.AddressLines` — blank parts leave no separator, an empty line is skipped (booking, quote, invoice provider box + invoice bill-to). `PdfAddressLinesTests` |
| A-2 | the clients send NO service address for an at-store booking when the provider has no street (`atStoreServiceAddress`, customer web + phone) — the address is optional on the server, so no server change; it also stops the city-level address being synced as the customer's own |
| A-3 | customer web `utils/businessMapLinks.js` (directions + embedded map), customer phone `directionsUrl` + `Area` static map — a blank street searches the city text, never a pin at the city centre |
| A-4 | customer web JSON-LD omits empty `streetAddress`/`postalCode` and `geo` when the street is blank |
| A-5 | admin web + phone Step 1: street/postal required only when the admin edits the address in this session; a stored city-level address is not re-sent |
| A-6 | not changed — renders cleanly (empty JSON strings); noted for the §27 audit |
| H-1 | customer web cart picker ignores `isConfigured: false` rows: no hours at all ⇒ the existing default window. A day never set in a PARTLY set week stays not offered — the established rule the phone app pins (`session24Parity`) |
| H-3 | receptionist instructions: when the weekly hours are empty, an explicit "hours not listed — never say closed" line. Today every business has seeded hours, so no live prompt changes (the prompt-size guard's "everything on" fixture now has hours, as a real business has) |
| H-4 | `get_business_profile` carries `hoursNote` (the existing `NoAvailability` note) when there are no hours |
| H-5 | `Availability.IsConfigured` — response only, `[Newtonsoft.Json.JsonIgnore]` so the Cosmos serializer never stores it (test serializes with `ClinqetCosmosSerializer`); private `GET business/availability` marks synthesized days false. Admin web + phone notice; provider web + phone "Suggested" day labels + notice, locations week summary "No hours set yet" (shared `renderingRules`, parity test) |
| **H-2 / H-2b** | **SUPERSEDED by the owner decision below.** Was: NOT done — the edit was refused by this session's permission check** (it changes the search documents: provider index `null` when a business has no rows, service index `DayAvailability.IsAvailable` `bool` → `bool?`, and the "available on day" filter `eq true` → `ne false`). Both C# types map to the same `Edm.Boolean` field, so the index definition itself does not change. **Owner decision needed.** Until then a business with no hours is left out of the "available on {day}" filter (it still appears in every other search) |

### Owner decisions 2026-10-07 (in conversation)
- **Hours (A, approved):** no hours are ever invented — the profile-creation seed of Mon–Sun 09:00–17:00 is REMOVED for every
  business (provider onboarding, admin wizard, AI setup, import); editors still pre-fill 9–5 marked "Suggested" and only a
  Save stores hours; customers see one "Hours not listed" line; the search indexes store `null` (unknown) per day when a
  business has no rows (`DayAvailability.IsAvailable` `bool?` — the SAME `Edm.Boolean` field, pinned by
  `UnknownHoursIndexFieldTests`); the "available on {day}" filter is unchanged (`eq true` — a filter is a promise, unknown is
  not shown, like Google "open now"); existing stored hours are left alone. H-2 is closed by this.
- **B (approved, recommendation kept):** an FAQ an admin deletes on a not-yet-claimed business comes back if a later upload
  still carries it (shown in the item's "added" list); the admin apps' hours notice is English (admin apps are English by design).

## 2a. After Phase 3 (current tree)
| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | 16,406 passed before the import options; all pass after (+ new tests) |
| `Clinqet.API.IntegrationTests` | 2,657 passed, 18 skipped, 1 failed = PRE-2 (order-dependent, fixed); the three AI-setup suites (catalogue manifest, chunked extraction, reading conservation) all pass on the moved applier |
| `Clinqet.Identity.IntegrationTests` | 660 passed (657 + 3 migration tests) |

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

> Note (2026-10-07 18:04): the session scratchpad was wiped by an over-broad cleanup in a helper agent — it took the frozen
> source snapshot and the baseline logs. The unit-baseline numbers above were already recorded. The integration baseline
> snapshot was rebuilt from `git archive` of each repo's session-start commit (+ PRE-1) and re-run.

## 9. Phase 4–5 design notes (2026-10-07)
| # | Decision | Why |
|---|---|---|
| R-4 | Account and business are NOT one SQL transaction: the account commits (shared `TryInsertPreparedUserAsync`, same as the admin form), then the business is ensured; a redelivery with the same deterministic `userId` finds the account (`AlreadyCreated`) and finishes the business | `BusinessProvisioningService.CreateAsync` owns its own execution-strategy transaction + applock; nesting it would mean rewriting business creation. Convergence gives the same end state |
| R-5 | Prepared businesses never enqueue the offer-match / trial announcement: new `IBusinessProvisioningService.CreatePreparedBusinessAsync` (the explicit path, `enqueueOfferMatch: false`) | §11A.3 step 5 — closed at the source |
| R-6 | Identity internal endpoint: `ProviderImportInternal:{ApiKey (≥32, boot refuses), RateLimitPerMinute 60}`; key compared via SHA-256 + `FixedTimeEquals`; ASP.NET fixed-window rate limiter (429 + Retry-After); `[AllowAnonymous]` + key filter; no CORS policy | §11A.1 |
| R-7 | The import's Identity client retries transient failures itself (3 attempts, exponential; 5xx/timeouts only, never a 4xx) instead of a Polly handler | the library does not reference `Microsoft.Extensions.Http.Polly`; a dozen lines, unit-tested |
| R-8 | `IAzureStorageService.UploadPrivateBlobAsync` (Cache-Control `no-store`) for every import blob | the existing upload stamps `public, max-age` — wrong for files full of contact details |
| R-9 | A removed (inactive) PREPARED account keeps its phone blocked in both the Identity classifier and the plan matcher | §10.4 |
| R-10 | Take-over lifts the import hold through the ONE shared `ImportedProfileActivation` (also behind `ActivateImportedAsync`); a failure raises `ProviderImportActivationFailed` (High, EventId per business), the take-over still succeeds | §10.5 |

## 10. Phase 5 orchestration — decisions taken while building (2026-10-07)
- **R-11 AI outage threshold (§11.8).** The run document has no "consecutive AI failures" field, and adding one is a schema
  change. Because lanes are chained, a lane cannot move past a provider whose AI call fails, so "N consecutive items failing on
  AI" is measured as N deliveries of the SAME provider failing on AI (`Processing:AiOutageItemThreshold`, 3, below the queue's
  maxDeliveryCount 5). Below the threshold the delivery is rethrown (Service Bus redelivers); at it the run pauses
  `PausedAiUnavailable` with one High alert. A provider whose own content keeps failing is still bounded: a call is counted
  when it is ASKED, so its AI budget (planned chunks + `MaxAiCallsPerProvider`, across attempts) ends it `Failed:
  AiBudgetExhausted`.
- **R-12 Bank key.** The curation bank keys on exactly what is sent (system prompt + user prompt + schema + deployment +
  effort + rules version). The user prompt is built without the volatile fields (scrapedAt, completeness, sources, batch),
  so a re-scrape of an unchanged business is a free hit; verification runs after the bank, so changing a §9.4 check needs no
  version bump.
- **R-13 Second-opinion merge (§9.5).** Agreement (the reviewer says `agrees` AND name, primary category, merge verdict and
  every kept price match after both answers pass §9.4) ⇒ the reviewer's checked answer. Otherwise: source name, the
  deterministic price for each differing service, `not_same_business` for a merge disagreement (⇒ MergeVetoed, nothing
  created), CategoryUncertain for a category disagreement, and the provider is held (`AiDisagreement`).
- **R-14 AI price reading.** The AI may only fill a price when the deterministic price is On request, the evidence is a
  substring of the service's price text / notes / description and every number appears in the evidence. A "range" becomes
  StartingFrom with Start/Max (the platform has no range price type).
- **R-15 AI hours reading.** Accepted only when all seven days are given (the same rule as the structured week), each open
  day one period with open < close, and every time appears in the evidence (12 h / 24 h / "9h30" forms).
- **R-16 Friendly-name candidates for a non-Latin name.** The slug of an Indic-script name is empty, so only the bot's and
  the AI's candidates are offered; none ⇒ `NoFriendlyName` review flag.
- **R-17 Item state.** Checkpoints are the item `stage` plus blobs `prepared`, `ai-curation`, `shell`, `result`. The
  `shell` blob records whether the import created the profile (a FillGaps item whose shell the import had to create gets the
  New-item verdict, §11.3 S6).
- **R-18 Function wrapper parked.** `ProviderImportFunctions.cs` (validate / item / sweeper triggers) is kept in
  `Data/provider-import/handoff/` until the host registration and the photo copier exist, so a deployed Functions host never
  runs a trigger whose services are not registered.

## 11. Closed after the owner's review of the hand-over (2026-10-07)
- **X2 same-request race — two real defects, both proven on real SQL then fixed.** (1) The import's deterministic account id
  losing to its own redelivery raised a `PK_UserProfile` violation as a 500 (`TryInsertPreparedUserAsync` excluded its own id
  from the re-check). (2) Concurrent copies of one request that lost the business creation answered `OwnershipLimit`.
  Tests: `ProviderImportAccountRaceIntegrationTests` (redelivery committed between the check and the insert — deterministic,
  via a SaveChanges interceptor; and 4 copies in parallel).
- **Minimum-spend offers (owner: yes).** Carried through the shared offer saver into the EXISTING `Offer.MinValue`; signature
  gains `|min:` only when a minimum exists, so existing offer ids are unchanged; a minimum ≤ 0 refuses the offer.
- **Admin constants → settings**: `Storage:ReadLinkMinutes`, `Limits:MaxBulkApprove`, `Limits:DefaultRunsPageSize`.
- **"Not now" on the name prompt** snoozes it on web AND phone (the latest dismissal from either surface counts) — kept as
  built; the owner to confirm.
